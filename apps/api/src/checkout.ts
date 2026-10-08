import { database } from '@workspace/data/client'
import { orders, creditAccounts, creditGrants, stripeEvents, now } from '@workspace/data/schema'
import { and, eq, sql } from 'drizzle-orm'
import Stripe from 'stripe'
import type { Env } from './env'
import { HttpError, json, reply, input, methodNotAllowed, readBody } from './http'
import { rateLimit } from './rate-limit'
import { CREDIT_PACK } from './billing'

function checkoutStatus(session: Stripe.Checkout.Session) {
	const status = session.status
	if (status === 'open') return 'open' as const
	if (status === 'complete') return 'complete' as const
	if (status === 'expired') return 'expired' as const
	return null
}

export function checkoutEnabled(env: Env) {
	return Boolean(
		env.STRIPE_SECRET_KEY?.match(/^(sk|rk)_test_/) &&
		env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_') &&
		env.STRIPE_PRICE_ID &&
		env.STRIPE_WEBHOOK_SECRET,
	)
}

function stripeClient(env: Env) {
	if (!checkoutEnabled(env)) throw new HttpError(503, 'Test checkout is not configured yet')
	return new Stripe(env.STRIPE_SECRET_KEY ?? '', {
		httpClient: Stripe.createFetchHttpClient(),
		maxNetworkRetries: 1,
		timeout: 10000,
	})
}

async function offer(env: Env, stripe: Stripe) {
	const price = await stripe.prices.retrieve(env.STRIPE_PRICE_ID ?? '', { expand: ['product'] })
	if (
		price.livemode ||
		!price.active ||
		price.type !== 'one_time' ||
		!price.unit_amount ||
		price.unit_amount <= 0
	)
		throw new HttpError(503, 'Configure an active one-time test price')
	const product = price.product
	if (typeof product === 'string' || product.deleted || !product.active)
		throw new HttpError(503, 'Configure an active test product')
	return {
		name: product.name,
		credits: CREDIT_PACK,
		priceId: price.id,
		description: product.description,
		amount: price.unit_amount,
		currency: price.currency,
	}
}

async function reconcile(env: Env, session: Stripe.Checkout.Session, eventId?: string) {
	const db = database(env.DB)
	const order = await db
		.select()
		.from(orders)
		.where(eq(orders.id, session.metadata?.order_id ?? ''))
		.get()
	// Other projects may share the Stripe account. Ignore their sessions.
	if (!order) return
	if (
		session.livemode ||
		session.mode !== 'payment' ||
		session.client_reference_id !== order.user_id ||
		session.amount_total !== order.amount ||
		session.currency !== order.currency ||
		(order.stripe_session_id && order.stripe_session_id !== session.id)
	)
		throw new HttpError(400, 'Checkout session does not match this order')
	const status =
		session.payment_status === 'paid' && session.status === 'complete'
			? 'paid'
			: session.status === 'expired'
				? 'expired'
				: 'pending'
	const grantId = crypto.randomUUID()
	// The order, immutable grant and credit balance commit in one D1 transaction.
	const update = db
		.update(orders)
		.set({
			stripe_session_id: session.id,
			status: sql`CASE WHEN ${orders.status} = 'paid' THEN 'paid' ELSE ${status} END`,
			updated_at: now,
		})
		.where(eq(orders.id, order.id))
	const account = db.insert(creditAccounts).values({ user_id: order.user_id }).onConflictDoNothing()
	const grant = db
		.insert(creditGrants)
		.select(
			db
				.select({
					id: sql<string>`${grantId}`.as('id'),
					user_id: orders.user_id,
					order_id: orders.id,
					credits: orders.credits,
					created_at: now.as('created_at'),
				})
				.from(orders)
				.where(and(eq(orders.id, order.id), eq(orders.status, 'paid'), sql`${orders.credits} > 0`)),
		)
		.onConflictDoNothing({ target: creditGrants.order_id })
	const balance = db
		.update(creditAccounts)
		.set({
			balance: sql`${creditAccounts.balance} + (select ${creditGrants.credits} from ${creditGrants} where ${creditGrants.id} = ${grantId})`,
		})
		.where(
			and(
				eq(creditAccounts.user_id, order.user_id),
				sql`EXISTS (select 1 from ${creditGrants} where ${creditGrants.id} = ${grantId})`,
			),
		)
	if (eventId)
		await db.batch([
			update,
			account,
			grant,
			balance,
			db.insert(stripeEvents).values({ id: eventId }).onConflictDoNothing(),
		])
	else await db.batch([update, account, grant, balance])
}

export async function stripeWebhook(request: Request, env: Env) {
	if (request.method !== 'POST') return methodNotAllowed('POST')
	const stripe = stripeClient(env)
	const signature = request.headers.get('stripe-signature')
	if (!signature) throw new HttpError(400, 'Missing Stripe signature')
	const raw = new TextDecoder().decode(await readBody(request, 256 * 1024))
	let event: Stripe.Event
	try {
		event = await stripe.webhooks.constructEventAsync(
			raw,
			signature,
			env.STRIPE_WEBHOOK_SECRET ?? '',
			300,
			Stripe.createSubtleCryptoProvider(),
		)
	} catch {
		throw new HttpError(400, 'Invalid Stripe signature')
	}
	if (event.livemode) throw new HttpError(400, 'This example accepts test events only')
	if (
		[
			'checkout.session.completed',
			'checkout.session.async_payment_succeeded',
			'checkout.session.async_payment_failed',
			'checkout.session.expired',
		].includes(event.type)
	) {
		if (
			await database(env.DB)
				.select({ id: stripeEvents.id })
				.from(stripeEvents)
				.where(eq(stripeEvents.id, event.id))
				.get()
		)
			return json({ received: true })
		// Retrieve canonical Stripe state, so delayed/reordered events cannot undo a payment.
		const session = await stripe.checkout.sessions.retrieve(
			(event.data.object as Stripe.Checkout.Session).id,
		)
		await reconcile(env, session, event.id)
	}
	return json({ received: true })
}

export async function checkoutRoute(
	request: Request,
	env: Env,
	user: { id: string; email: string },
) {
	const url = new URL(request.url)
	const db = database(env.DB)
	const stripe = stripeClient(env)
	if (url.pathname === '/api/checkout/config') {
		if (request.method !== 'GET') return methodNotAllowed('GET')
		return reply('checkoutConfig', {
			publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? '',
			offer: await offer(env, stripe),
		})
	}
	if (url.pathname === '/api/checkout/sessions') {
		if (request.method !== 'POST') return methodNotAllowed('POST')
		const body = await input(request, 'createCheckout')
		await rateLimit(env.DB, `checkout:${user.id}`, 10, 60)
		const product = await offer(env, stripe)
		await db
			.insert(orders)
			.values({
				id: crypto.randomUUID(),
				user_id: user.id,
				request_id: body.requestId,
				amount: product.amount,
				currency: product.currency,
				credits: product.credits,
				price_id: product.priceId,
			})
			.onConflictDoNothing({ target: [orders.user_id, orders.request_id] })
		const order = await db
			.select()
			.from(orders)
			.where(and(eq(orders.user_id, user.id), eq(orders.request_id, body.requestId)))
			.get()
		if (!order) throw new Error('Order could not be created')
		const session = order.stripe_session_id
			? await stripe.checkout.sessions.retrieve(order.stripe_session_id)
			: await stripe.checkout.sessions.create(
					{
						ui_mode: 'elements',
						mode: 'payment',
						allowed_payment_method_types: ['card'],
						adaptive_pricing: { enabled: false },
						line_items: [{ price: order.price_id ?? env.STRIPE_PRICE_ID ?? '', quantity: 1 }],
						customer_email: user.email,
						client_reference_id: user.id,
						metadata: { order_id: order.id },
						return_url: `${env.AUTH_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
					},
					{ idempotencyKey: `starter-checkout-${order.id}` },
				)
		await reconcile(env, session)
		return reply(
			'createCheckout',
			{
				clientSecret: session.client_secret,
				sessionId: session.id,
				status: checkoutStatus(session),
			},
			201,
		)
	}
	const match = url.pathname.match(/^\/api\/checkout\/sessions\/(cs_test_[A-Za-z0-9]+)$/)
	if (match) {
		if (request.method !== 'GET') return methodNotAllowed('GET')
		const order = await db
			.select()
			.from(orders)
			.where(and(eq(orders.stripe_session_id, match[1]), eq(orders.user_id, user.id)))
			.get()
		if (!order) throw new HttpError(404, 'Checkout not found')
		await rateLimit(env.DB, `checkout-status:${user.id}`, 60, 60)
		const session = await stripe.checkout.sessions.retrieve(match[1])
		await reconcile(env, session)
		const saved = await db
			.select({
				id: orders.id,
				amount: orders.amount,
				currency: orders.currency,
				credits: orders.credits,
				status: orders.status,
			})
			.from(orders)
			.where(eq(orders.id, order.id))
			.get()
		if (!saved) throw new HttpError(404, 'Checkout not found')
		return reply('order', { order: saved, checkoutStatus: checkoutStatus(session) })
	}
	throw new HttpError(404, 'Checkout not found')
}

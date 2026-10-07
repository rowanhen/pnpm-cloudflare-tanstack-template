import Stripe from 'stripe'
import type { Env } from './env'
import { HttpError, json, methodNotAllowed, readBody, readJson } from './http'
import { rateLimit } from './rate-limit'

type Order = {
	id: string
	user_id: string
	stripe_session_id: string | null
	amount: number
	currency: string
	status: string
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
		description: product.description,
		amount: price.unit_amount,
		currency: price.currency,
	}
}

async function reconcile(env: Env, session: Stripe.Checkout.Session, eventId?: string) {
	const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?')
		.bind(session.metadata?.order_id ?? '')
		.first<Order>()
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
	const update = env.DB.prepare(
		"UPDATE orders SET stripe_session_id = ?, status = CASE WHEN status = 'paid' THEN 'paid' ELSE ? END, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
	).bind(session.id, status, order.id)
	if (eventId) {
		// D1 batches commit atomically. Duplicate delivery cannot double-fulfil an order.
		await env.DB.batch([
			update,
			env.DB.prepare('INSERT INTO stripe_events(id) VALUES (?) ON CONFLICT(id) DO NOTHING').bind(
				eventId,
			),
		])
	} else await update.run()
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
		if (await env.DB.prepare('SELECT id FROM stripe_events WHERE id = ?').bind(event.id).first())
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
	const stripe = stripeClient(env)
	if (url.pathname === '/api/checkout/config') {
		if (request.method !== 'GET') return methodNotAllowed('GET')
		return json({ publishableKey: env.STRIPE_PUBLISHABLE_KEY, offer: await offer(env, stripe) })
	}
	if (url.pathname === '/api/checkout/sessions') {
		if (request.method !== 'POST') return methodNotAllowed('POST')
		const body = await readJson(request)
		if (
			typeof body.requestId !== 'string' ||
			!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(body.requestId)
		)
			throw new HttpError(400, 'Provide a UUID requestId')
		if (Object.keys(body).some((key) => key !== 'requestId'))
			throw new HttpError(400, 'Only requestId is accepted; the server selects the price')
		await rateLimit(env.DB, `checkout:${user.id}`, 10, 60)
		const product = await offer(env, stripe)
		await env.DB.prepare(
			'INSERT INTO orders(id, user_id, request_id, amount, currency) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, request_id) DO NOTHING',
		)
			.bind(crypto.randomUUID(), user.id, body.requestId, product.amount, product.currency)
			.run()
		const order = await env.DB.prepare('SELECT * FROM orders WHERE user_id = ? AND request_id = ?')
			.bind(user.id, body.requestId)
			.first<Order>()
		if (!order) throw new Error('Order could not be created')
		const session = order.stripe_session_id
			? await stripe.checkout.sessions.retrieve(order.stripe_session_id)
			: await stripe.checkout.sessions.create(
					{
						ui_mode: 'elements',
						mode: 'payment',
						allowed_payment_method_types: ['card'],
						adaptive_pricing: { enabled: false },
						line_items: [{ price: env.STRIPE_PRICE_ID ?? '', quantity: 1 }],
						customer_email: user.email,
						client_reference_id: user.id,
						metadata: { order_id: order.id },
						return_url: `${env.AUTH_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
					},
					{ idempotencyKey: `starter-checkout-${order.id}` },
				)
		await reconcile(env, session)
		return json(
			{ clientSecret: session.client_secret, sessionId: session.id, status: session.status },
			201,
		)
	}
	const match = url.pathname.match(/^\/api\/checkout\/sessions\/(cs_test_[A-Za-z0-9]+)$/)
	if (match) {
		if (request.method !== 'GET') return methodNotAllowed('GET')
		const order = await env.DB.prepare(
			'SELECT * FROM orders WHERE stripe_session_id = ? AND user_id = ?',
		)
			.bind(match[1], user.id)
			.first<Order>()
		if (!order) throw new HttpError(404, 'Checkout not found')
		await rateLimit(env.DB, `checkout-status:${user.id}`, 60, 60)
		const session = await stripe.checkout.sessions.retrieve(match[1])
		await reconcile(env, session)
		const saved = await env.DB.prepare(
			'SELECT id, amount, currency, status FROM orders WHERE id = ?',
		)
			.bind(order.id)
			.first()
		return json({ order: saved, checkoutStatus: session.status })
	}
	throw new HttpError(404, 'Checkout not found')
}

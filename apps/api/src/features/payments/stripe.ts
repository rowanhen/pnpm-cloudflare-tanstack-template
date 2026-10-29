import { Effect, Layer, Schema } from 'effect'
import { Stripe } from 'stripe'
import { InvalidInput, ProviderFailure, Unavailable } from '../../errors'
import { PaymentGateway, PaymentSession, type CheckoutIntent } from './service'

const Price = Schema.Struct({
	id: Schema.String,
	livemode: Schema.Boolean,
	active: Schema.Boolean,
	type: Schema.Literals(['one_time', 'recurring']),
	unit_amount: Schema.NullOr(Schema.Number.check(Schema.isInt())),
	currency: Schema.String,
	recurring: Schema.NullOr(Schema.Struct({ interval: Schema.String })),
	product: Schema.Unknown,
})
const Product = Schema.Struct({
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	active: Schema.Boolean,
})
const Event = Schema.Struct({
	id: Schema.String,
	type: Schema.String,
	livemode: Schema.Boolean,
	data: Schema.Struct({ object: Schema.Unknown }),
})
const SessionId = Schema.Struct({ id: Schema.String.check(Schema.isMinLength(1)) })
const decode = <A>(schema: Schema.Codec<A, unknown>, value: unknown) =>
	Schema.decodeUnknownEffect(schema)(value).pipe(
		Effect.mapError(
			(cause) => new ProviderFailure({ message: 'Payment provider returned invalid data', cause }),
		),
	)

const decodeEvent = <A>(schema: Schema.Codec<A, unknown>, value: unknown) =>
	Schema.decodeUnknownEffect(schema)(value).pipe(
		Effect.mapError(() => new InvalidInput({ message: 'Invalid webhook event' })),
	)

export const stripeLayer = (settings: {
	secretKey?: string
	webhookSecret?: string
	origin: string
}) => {
	const client = (signal: AbortSignal) =>
		new Stripe(settings.secretKey ?? '', {
			httpClient: Stripe.createFetchHttpClient((url, init) =>
				fetch(url, {
					...init,
					signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]),
				}),
			),
			maxNetworkRetries: 0,
			timeout: 10000,
		})
	const call = <A>(run: (stripe: Stripe) => Promise<A>) =>
		Effect.gen(function* () {
			if (!settings.secretKey?.match(/^(sk|rk)_test_/))
				return yield* Effect.fail(new Unavailable({ message: 'Test checkout is not configured' }))
			return yield* Effect.tryPromise({
				try: (signal) => run(client(signal)),
				catch: (cause) =>
					new ProviderFailure({
						message: 'Payment provider is unavailable. Please try again.',
						cause,
					}),
			})
		})
	const parameters = (intent: CheckoutIntent): Stripe.Checkout.SessionCreateParams => ({
		ui_mode: 'elements',
		mode: intent.kind === 'credits' || intent.product === 'purchase' ? 'payment' : 'subscription',
		allowed_payment_method_types: ['card'],
		adaptive_pricing: { enabled: false },
		line_items: [{ price: intent.priceId, quantity: 1 }],
		...(intent.kind === 'credits'
			? {
					customer_email: intent.email,
					client_reference_id: intent.userId,
					metadata: { order_id: intent.orderId },
					return_url: `${settings.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
				}
			: {
					metadata: { example: 'storefront', guest_token_hash: intent.tokenHash },
					...(intent.product === 'subscription'
						? { subscription_data: { metadata: { example: 'storefront' } } }
						: {}),
					return_url: `${settings.origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
				}),
	})
	return Layer.succeed(PaymentGateway, {
		price: (id, kind) =>
			Effect.gen(function* () {
				const price = yield* decode(
					Price,
					yield* call((stripe) => stripe.prices.retrieve(id, { expand: ['product'] })),
				)
				const product = yield* decode(Product, price.product)
				if (
					price.livemode ||
					!price.active ||
					price.type !== kind ||
					price.unit_amount === null ||
					price.unit_amount < 1 ||
					!product.active
				)
					return yield* Effect.fail(
						new Unavailable({ message: 'Configure active test products and prices' }),
					)
				return {
					priceId: price.id,
					name: product.name,
					description: product.description,
					amount: price.unit_amount,
					currency: price.currency,
					interval: price.recurring?.interval ?? null,
				}
			}),
		session: (id) =>
			call((stripe) => stripe.checkout.sessions.retrieve(id)).pipe(
				Effect.flatMap((s) => decode(PaymentSession, s)),
			),
		create: (intent) =>
			call((stripe) =>
				stripe.checkout.sessions.create(parameters(intent), {
					idempotencyKey:
						intent.kind === 'credits'
							? `starter-checkout-${intent.orderId}`
							: `storefront-elements-${intent.tokenHash}-${intent.requestId}-${intent.product}`,
				}),
			).pipe(Effect.flatMap((s) => decode(PaymentSession, s))),
		verify: (raw, signature) =>
			Effect.gen(function* () {
				if (!settings.webhookSecret)
					return yield* Effect.fail(new Unavailable({ message: 'Webhook is not configured' }))
				if (!signature)
					return yield* Effect.fail(new InvalidInput({ message: 'Missing Stripe signature' }))
				const event = yield* decodeEvent(
					Event,
					yield* call((stripe) =>
						stripe.webhooks.constructEventAsync(
							raw,
							signature,
							settings.webhookSecret ?? '',
							300,
							Stripe.createSubtleCryptoProvider(),
						),
					).pipe(
						Effect.catchTag(
							'ProviderFailure',
							(error): Effect.Effect<never, InvalidInput | ProviderFailure> =>
								error.cause instanceof Stripe.errors.StripeSignatureVerificationError ||
								error.cause instanceof SyntaxError
									? Effect.fail(new InvalidInput({ message: 'Invalid Stripe signature' }))
									: Effect.fail(error),
						),
					),
				)
				if (event.livemode)
					return yield* Effect.fail(
						new InvalidInput({ message: 'This example accepts test events only' }),
					)
				if (
					![
						'checkout.session.completed',
						'checkout.session.async_payment_succeeded',
						'checkout.session.async_payment_failed',
						'checkout.session.expired',
					].includes(event.type)
				)
					return { kind: 'ignored' as const }
				const session = yield* decodeEvent(SessionId, event.data.object)
				return { kind: 'checkout' as const, eventId: event.id, sessionId: session.id }
			}),
	})
}

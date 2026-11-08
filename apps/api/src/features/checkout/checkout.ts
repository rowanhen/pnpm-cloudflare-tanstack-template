import { Effect } from 'effect'
import { CheckoutInput } from '@workspace/contracts/values'
import { MissingRecord, Unavailable } from '../../errors'
import type { StorageError } from '../../persistence'
import { type StoredOrder, reconciliationStatus } from './domain'
import { validate } from '../../validation'
import type { PaymentGateway, PaymentSession } from '../payments/payments'
import { CREDIT_PACK } from '../billing/domain'
import type { RateLimiter } from '../rate-limits/rate-limits'
export type CheckoutSettings =
	| { readonly enabled: false }
	| { readonly enabled: true; readonly priceId: string; readonly publishableKey: string }
export type CheckoutActor = { readonly userId: string; readonly email: string }
export type CheckoutRepository = {
	readonly reserve: (
		userId: string,
		requestId: string,
		offer: { amount: number; currency: string; credits: number; priceId: string },
	) => Effect.Effect<StoredOrder, StorageError>
	readonly find: (id: string) => Effect.Effect<StoredOrder | undefined, StorageError>
	readonly findOwned: (
		sessionId: string,
		userId: string,
	) => Effect.Effect<StoredOrder | undefined, StorageError>
	readonly reconcile: (
		order: StoredOrder,
		sessionId: string,
		status: 'pending' | 'paid' | 'expired',
		eventId?: string,
	) => Effect.Effect<void, StorageError>
	readonly received: (id: string) => Effect.Effect<boolean, StorageError>
}

const reconcile = (
	repository: CheckoutRepository,
	order: StoredOrder,
	session: PaymentSession,
	eventId?: string,
) =>
	Effect.gen(function* () {
		const status = yield* reconciliationStatus(order, session)
		yield* repository.reconcile(order, session.id, status, eventId)
	})
const configured = (settings: CheckoutSettings) =>
	Effect.gen(function* () {
		if (!settings.enabled)
			return yield* new Unavailable({ message: 'Test checkout is not configured yet' })
		return settings
	})
export const makeCheckout = ({
	settings,
	gateway,
	repository,
	actor,
	limiter,
}: {
	settings: CheckoutSettings
	gateway: PaymentGateway
	repository: CheckoutRepository
	actor: CheckoutActor
	limiter: RateLimiter
}) => {
	return {
		config: Effect.gen(function* () {
			const config = yield* configured(settings)
			const product = yield* gateway.price(config.priceId, 'one_time')
			return {
				publishableKey: config.publishableKey,
				offer: {
					name: product.name,
					credits: CREDIT_PACK,
					priceId: product.priceId,
					description: product.description,
					amount: product.amount,
					currency: product.currency,
				},
			}
		}),
		create: (input: typeof CheckoutInput.Type) =>
			Effect.gen(function* () {
				const config = yield* configured(settings)
				const body = yield* validate(CheckoutInput, input)
				yield* limiter.check(`checkout:${actor.userId}`, 10)
				const product = yield* gateway.price(config.priceId, 'one_time')
				const order = yield* repository.reserve(actor.userId, body.requestId, {
					...product,
					credits: CREDIT_PACK,
				})
				const session = yield* order.stripe_session_id
					? gateway.session(order.stripe_session_id)
					: gateway.create({
							kind: 'credits',
							priceId: order.price_id,
							orderId: order.id,
							userId: actor.userId,
							email: actor.email,
						})
				yield* reconcile(repository, order, session)
				return {
					clientSecret: session.client_secret,
					sessionId: session.id,
					status: session.status,
				}
			}),
		get: (sessionId: string) =>
			Effect.gen(function* () {
				yield* configured(settings)
				const order = yield* repository.findOwned(sessionId, actor.userId)
				if (!order) return yield* new MissingRecord({ message: 'Checkout not found' })
				yield* limiter.check(`checkout-status:${actor.userId}`, 60)
				const session = yield* gateway.session(sessionId)
				yield* reconcile(repository, order, session)
				const saved = yield* repository.findOwned(sessionId, actor.userId)
				if (!saved) return yield* new MissingRecord({ message: 'Checkout not found' })
				return {
					order: {
						id: saved.id,
						amount: saved.amount,
						currency: saved.currency,
						credits: saved.credits,
						status: saved.status,
					},
					checkoutStatus: session.status,
				}
			}),
	}
}
export const makeCheckoutWebhook = ({
	settings,
	gateway,
	repository,
}: {
	settings: CheckoutSettings
	gateway: PaymentGateway
	repository: CheckoutRepository
}) => {
	return {
		receive: (raw: string, signature: string) =>
			Effect.gen(function* () {
				yield* configured(settings)
				const event = yield* gateway.verify(raw, signature)
				if (event.kind === 'checkout' && !(yield* repository.received(event.eventId))) {
					const session = yield* gateway.session(event.sessionId)
					const order = yield* repository.find(session.metadata?.order_id ?? '')
					// Other projects may share this provider account; only webhooks ignore foreign orders.
					if (order) yield* reconcile(repository, order, session, event.eventId)
				}
				return { received: true }
			}),
	}
}

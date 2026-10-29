import { Effect, Layer } from 'effect'
import { CheckoutInput } from '@workspace/contracts/values'
import { MissingRecord, Unavailable } from '../../errors'
import { validate } from '../../validation'
import { PaymentGateway, type PaymentSession } from '../payments/service'
import { CREDIT_PACK } from '../billing/domain'
import { RateLimiter } from '../rate-limits/service'
import { reconciliationStatus, type StoredOrder } from './domain'
import {
	CheckoutActor,
	CheckoutRepository,
	CheckoutService,
	CheckoutSettings,
	CheckoutWebhook,
} from './service'

const reconcile = (
	repository: typeof CheckoutRepository.Service,
	order: StoredOrder,
	session: PaymentSession,
	eventId?: string,
) =>
	Effect.gen(function* () {
		const status = yield* reconciliationStatus(order, session)
		yield* repository.reconcile(order, session.id, status, eventId)
	})
const configured = (settings: typeof CheckoutSettings.Service) =>
	Effect.gen(function* () {
		if (!settings.enabled)
			return yield* Effect.fail(new Unavailable({ message: 'Test checkout is not configured yet' }))
		return settings
	})
export const CheckoutLive = Layer.effect(
	CheckoutService,
	Effect.gen(function* () {
		const settings = yield* CheckoutSettings
		const gateway = yield* PaymentGateway
		const repository = yield* CheckoutRepository
		const actor = yield* CheckoutActor
		const limiter = yield* RateLimiter
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
			create: (input) =>
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
			get: (sessionId) =>
				Effect.gen(function* () {
					yield* configured(settings)
					const order = yield* repository.findOwned(sessionId, actor.userId)
					if (!order)
						return yield* Effect.fail(new MissingRecord({ message: 'Checkout not found' }))
					yield* limiter.check(`checkout-status:${actor.userId}`, 60)
					const session = yield* gateway.session(sessionId)
					yield* reconcile(repository, order, session)
					const saved = yield* repository.findOwned(sessionId, actor.userId)
					if (!saved)
						return yield* Effect.fail(new MissingRecord({ message: 'Checkout not found' }))
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
	}),
)
export const CheckoutWebhookLive = Layer.effect(
	CheckoutWebhook,
	Effect.gen(function* () {
		const settings = yield* CheckoutSettings
		const gateway = yield* PaymentGateway
		const repository = yield* CheckoutRepository
		return {
			receive: (raw, signature) =>
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
	}),
)

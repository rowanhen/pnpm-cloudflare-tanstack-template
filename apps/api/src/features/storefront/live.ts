import { Effect, Layer } from 'effect'
import { StorefrontCreateData, StorefrontCheckData } from '@workspace/contracts/values'
import { MissingRecord, Unavailable, type ApplicationError } from '../../errors'
import type { StorageError } from '../../persistence'
import { preserveFatal } from '../../effect-errors'
import { IdentityCrypto } from '../../identity'
import { validate } from '../../validation'
import { PaymentGateway } from '../payments/service'
import { RateLimiter } from '../rate-limits/service'
import { StorefrontService, StorefrontSettings } from './service'
export const StorefrontLive = Layer.effect(
	StorefrontService,
	Effect.gen(function* () {
		const settings = yield* StorefrontSettings
		const gateway = yield* PaymentGateway
		const crypto = yield* IdentityCrypto
		const limiter = yield* RateLimiter
		const configured = settings.enabled
			? Effect.succeed(settings)
			: Effect.fail(new Unavailable({ message: 'Test checkout is not configured' }))
		const limit = (ip: string, action: string, maximum: number) =>
			crypto
				.hash(ip)
				.pipe(Effect.flatMap((hash) => limiter.check(`storefront:${action}:${hash}`, maximum)))
		const available = <A, R>(effect: Effect.Effect<A, ApplicationError | StorageError, R>) =>
			effect.pipe(
				preserveFatal,
				Effect.catchTag('ProviderFailure', () =>
					Effect.fail(
						new Unavailable({ message: 'Payment provider is unavailable. Please try again.' }),
					),
				),
			)
		return {
			catalogue: (ip) =>
				available(
					Effect.gen(function* () {
						if (!settings.enabled) return { enabled: false as const, products: [] as const }
						yield* limit(ip, 'catalogue', 60)
						const products = yield* Effect.all(
							(['purchase', 'subscription'] as const).map((id) =>
								Effect.gen(function* () {
									const product = yield* gateway.price(
										id === 'purchase' ? settings.purchasePrice : settings.subscriptionPrice,
										id === 'purchase' ? 'one_time' : 'recurring',
									)
									return {
										id,
										name: product.name,
										amount: product.amount,
										currency: product.currency,
										interval: product.interval,
									}
								}),
							),
							{ concurrency: 2 },
						)
						return { enabled: true as const, products }
					}),
				),
			create: (ip, input) =>
				available(
					Effect.gen(function* () {
						const body = yield* validate(StorefrontCreateData, input)
						yield* limit(ip, 'create', 10)
						const config = yield* configured
						const offer = yield* gateway.price(
							body.product === 'purchase' ? config.purchasePrice : config.subscriptionPrice,
							body.product === 'purchase' ? 'one_time' : 'recurring',
						)
						const session = yield* gateway.create({
							kind: 'storefront',
							product: body.product,
							priceId: offer.priceId,
							tokenHash: yield* crypto.hash(body.token),
							requestId: body.requestId,
						})
						if (session.livemode || !session.client_secret)
							return yield* Effect.fail(
								new Unavailable({ message: 'Unable to open test checkout' }),
							)
						return {
							sessionId: session.id,
							clientSecret: session.client_secret,
							publishableKey: config.publishableKey,
						}
					}),
				),
			check: (ip, input) =>
				available(
					Effect.gen(function* () {
						const body = yield* validate(StorefrontCheckData, input)
						yield* limit(ip, 'status', 60)
						yield* configured
						const session = yield* gateway.session(body.sessionId)
						if (
							session.livemode ||
							session.metadata?.example !== 'storefront' ||
							session.metadata?.guest_token_hash !== (yield* crypto.hash(body.token)) ||
							(session.mode !== 'payment' && session.mode !== 'subscription')
						)
							return yield* Effect.fail(new MissingRecord({ message: 'Checkout not found' }))
						if (session.amount_total === null || session.currency === null)
							return yield* Effect.fail(
								new Unavailable({ message: 'Payment provider returned incomplete checkout data' }),
							)
						return {
							status:
								session.status === 'complete' && session.payment_status === 'paid'
									? ('paid' as const)
									: session.status === 'expired'
										? ('expired' as const)
										: session.status === 'open'
											? ('open' as const)
											: ('pending' as const),
							mode: session.mode,
							amount: session.amount_total,
							currency: session.currency,
						}
					}),
				),
		}
	}),
)

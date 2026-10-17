import { Effect } from 'effect'
import { Stripe } from 'stripe'
import type { GetStorefrontFailure } from '@workspace/contracts/operations'
import type { Env } from '../../env'
import { HttpError, sha256 } from '../../http'
import { rateLimit } from '../../rate-limit'

export function storefrontEnabled(env: Env) {
	return Boolean(
		env.STRIPE_SECRET_KEY?.match(/^(sk|rk)_test_/) &&
		env.STRIPE_DEMO_PRICE_ID &&
		env.STRIPE_SUBSCRIPTION_PRICE_ID,
	)
}
export function provider(env: Env) {
	if (!storefrontEnabled(env)) throw new HttpError(503, 'Test checkout is not configured')
	return new Stripe(env.STRIPE_SECRET_KEY ?? '', {
		httpClient: Stripe.createFetchHttpClient(),
		maxNetworkRetries: 1,
		timeout: 10000,
	})
}
export async function product(env: Env, id: 'purchase' | 'subscription', stripe = provider(env)) {
	const price = await stripe.prices.retrieve(
		(id === 'purchase' ? env.STRIPE_DEMO_PRICE_ID : env.STRIPE_SUBSCRIPTION_PRICE_ID) ?? '',
		{ expand: ['product'] },
	)
	const item = price.product
	if (
		price.livemode ||
		!price.active ||
		!price.unit_amount ||
		price.unit_amount < 1 ||
		typeof item === 'string' ||
		item.deleted ||
		!item.active ||
		(id === 'purchase' ? price.type !== 'one_time' : price.type !== 'recurring')
	)
		throw new HttpError(503, 'Configure active test products and prices')
	return {
		id,
		name: item.name,
		amount: price.unit_amount,
		currency: price.currency,
		interval: price.recurring?.interval ?? null,
		priceId: price.id,
	}
}
export async function limit(env: Env, request: Request, action: string, maximum: number) {
	const ip = request.headers.get('cf-connecting-ip') ?? 'local'
	await rateLimit(env.DB, `storefront:${action}:${await sha256(ip)}`, maximum)
}
// Expected provider/configuration errors retain the generated status/body contract.
export const attempt = <A>(run: () => Promise<A>) =>
	Effect.tryPromise({ try: run, catch: (error) => error }).pipe(
		Effect.catch(
			(
				error,
			): Effect.Effect<never, Extract<GetStorefrontFailure, { status: 400 | 404 | 429 | 503 }>> => {
				if (error instanceof HttpError) {
					switch (error.status) {
						case 400:
							return Effect.fail({
								status: 400 as const,
								body: { code: 'bad_request' as const, error: error.message },
							})
						case 404:
							return Effect.fail({
								status: 404 as const,
								body: { code: 'not_found' as const, error: error.message },
							})
						case 429:
							return Effect.fail({
								status: 429 as const,
								body: { code: 'too_many_requests' as const, error: error.message },
							})
						case 503:
							return Effect.fail({
								status: 503 as const,
								body: { code: 'unavailable' as const, error: error.message },
							})
					}
				}
				if (error instanceof Stripe.errors.StripeError)
					return Effect.fail({
						status: 503 as const,
						body: {
							code: 'unavailable' as const,
							error: 'Payment provider is unavailable. Please try again.',
						},
					})
				return Effect.die(error)
			},
		),
	)

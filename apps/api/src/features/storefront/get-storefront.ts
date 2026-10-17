import { Effect } from 'effect'
import type { GetStorefrontHandler } from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { attempt, product, storefrontEnabled, limit } from './service'
export const getStorefront: GetStorefrontHandler<PublicApiRequest> = () =>
	Effect.gen(function* () {
		const { env, request } = yield* PublicApiRequest
		if (!storefrontEnabled(env)) return { status: 200, body: { enabled: false, products: [] } }
		const products = yield* attempt(async () => {
			await limit(env, request, 'catalogue', 60)
			return Promise.all(
				(['purchase', 'subscription'] as const).map(async (id) => {
					const { priceId: _priceId, ...item } = await product(env, id)
					return item
				}),
			)
		})
		return { status: 200, body: { enabled: true, products } }
	})

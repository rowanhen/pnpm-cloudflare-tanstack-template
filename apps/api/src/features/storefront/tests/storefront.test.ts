import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Effect } from 'effect'
import { makeStorefront } from '../storefront.ts'
import type { IdentityCrypto } from '../../../identity.ts'
import { Unavailable } from '../../../errors.ts'
const limiter: Parameters<typeof makeStorefront>[0]['limiter'] = {
	check: (_key, limit) => Effect.succeed({ limit, remaining: limit - 1, reset: 120 }),
}
const identity: IdentityCrypto = {
	hash: (value) => Effect.succeed(`hash:${value}`),
	token: Effect.succeed('token'),
}
const requestId = '00000000-0000-4000-8000-000000000001'

describe('storefront', () => {
	test('when a provider omits the paid amount, storefront rejects the payment', async () => {
		const session = {
			id: 'cs_test_one',
			livemode: false,
			mode: 'payment',
			status: 'complete',
			payment_status: 'paid',
			client_reference_id: null,
			client_secret: null,
			amount_total: null,
			currency: null,
			metadata: { example: 'storefront', guest_token_hash: `hash:${requestId}` },
		} as const
		const service = makeStorefront({
			limiter,
			crypto: identity,
			settings: {
				enabled: true,
				purchasePrice: 'one',
				subscriptionPrice: 'two',
				publishableKey: 'pk_test',
			},
			gateway: {
				price: () => Effect.die('unused'),
				create: () => Effect.die('unused'),
				verify: () => Effect.die('unused'),
				session: () => Effect.succeed(session),
			},
		})
		const error = await Effect.runPromise(
			service.check('ip', { sessionId: session.id, token: requestId }).pipe(Effect.flip),
		)
		assert.ok(error instanceof Unavailable)
	})
})

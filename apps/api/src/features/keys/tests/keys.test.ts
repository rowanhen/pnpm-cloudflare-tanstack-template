import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Effect } from 'effect'
import * as TestClock from 'effect/testing/TestClock'
import { makeKeyAuthentication } from '../keys.ts'
import type { IdentityCrypto } from '../../../identity.ts'
import { Unauthorized, Forbidden } from '../../../errors.ts'
const limiter: Parameters<typeof makeKeyAuthentication>[0]['limiter'] = {
	check: (_key, limit) => Effect.succeed({ limit, remaining: limit - 1, reset: 120 }),
}
const identity: IdentityCrypto = {
	hash: (value) => Effect.succeed(`hash:${value}`),
	token: Effect.succeed('token'),
}

describe('keys', () => {
	test('when an API key is authenticated, scope is checked and usage is recorded', async () => {
		let lookups = 0
		const touches: unknown[] = []
		const service = makeKeyAuthentication({
			crypto: identity,
			limiter,
			repository: {
				find: () =>
					Effect.sync(() => {
						lookups++
						return { id: 'key', userId: 'owner', scope: 'summary:read' as const }
					}),
				touch: (id, millis) =>
					Effect.sync(() => {
						touches.push({ id, millis })
					}),
			},
		})
		const token = `idea_${'a'.repeat(64)}`
		await Effect.runPromise(
			Effect.gen(function* () {
				yield* TestClock.setTime(12_345)
				const auth = service
				assert.ok(
					(yield* auth.authenticate('invalid', 'summary:read').pipe(Effect.flip)) instanceof
						Unauthorized,
				)
				assert.equal(lookups, 0)
				assert.ok(
					(yield* auth.authenticate(token, 'todos:read').pipe(Effect.flip)) instanceof Forbidden,
				)
				assert.deepEqual(touches, [])
				assert.deepEqual(yield* auth.authenticate(token, 'summary:read'), {
					userId: 'owner',
					keyId: 'key',
					quota: { limit: 30, remaining: 29, reset: 120 },
				})
			}).pipe(Effect.provide(TestClock.layer())),
		)
		assert.deepEqual(touches, [{ id: 'key', millis: 12_345 }])
	})
})

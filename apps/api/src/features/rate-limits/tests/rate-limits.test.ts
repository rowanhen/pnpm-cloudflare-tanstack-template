import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Effect } from 'effect'
import * as TestClock from 'effect/testing/TestClock'
import { makeRateLimiter } from '../rate-limits.ts'
import { RateLimited } from '../../../errors.ts'

describe('rate-limits', () => {
	test('when the clock advances, rate limits preserve fixed-window retry behavior', async () => {
		const calls: unknown[] = []
		const service = makeRateLimiter({
			repository: {
				acquire: (key, limit, window) =>
					Effect.sync(() => {
						calls.push({ key, limit, window })
						return calls.length === 1 ? 1 : undefined
					}),
			},
		})
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* TestClock.setTime(61_000)
				const quota = yield* service.check('owner', 1)
				const failure = yield* service.check('owner', 1).pipe(Effect.flip)
				return { quota, failure }
			}).pipe(Effect.provide(TestClock.layer())),
		)
		assert.deepEqual(result.quota, { limit: 1, remaining: 0, reset: 120 })
		assert.ok(result.failure instanceof RateLimited)
		assert.equal(result.failure.retryAfter, 59)
		assert.deepEqual(calls, [
			{ key: 'owner', limit: 1, window: 60 },
			{ key: 'owner', limit: 1, window: 60 },
		])
	})
})

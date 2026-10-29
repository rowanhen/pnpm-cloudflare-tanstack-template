import { Clock, Effect, Layer } from 'effect'
import { RateLimited } from '../../errors'
import { RateLimiter, RateLimitRepository } from './service'
export const RateLimiterLive = Layer.effect(
	RateLimiter,
	Effect.gen(function* () {
		const repository = yield* RateLimitRepository
		return {
			check: (key, limit, seconds = 60) =>
				Effect.gen(function* () {
					if (
						!Number.isSafeInteger(limit) ||
						limit < 1 ||
						!Number.isSafeInteger(seconds) ||
						seconds < 1
					)
						return yield* Effect.die(new Error('Invalid rate limit policy'))
					const now = Math.floor((yield* Clock.currentTimeMillis) / 1000)
					const window = Math.floor(now / seconds) * seconds
					const count = yield* repository.acquire(key, limit, window)
					if (count === undefined)
						return yield* Effect.fail(
							new RateLimited({
								limit,
								reset: window + seconds,
								retryAfter: window + seconds - now,
							}),
						)
					return { limit, remaining: Math.max(0, limit - count), reset: window + seconds }
				}),
		}
	}),
)

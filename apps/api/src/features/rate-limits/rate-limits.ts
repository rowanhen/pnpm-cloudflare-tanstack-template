import { Effect, Clock } from 'effect'
import type { StorageError } from '../../persistence'
import { RateLimited } from '../../errors'
export type Quota = { readonly limit: number; readonly remaining: number; readonly reset: number }
export type RateLimitRepository = {
	readonly acquire: (
		key: string,
		limit: number,
		window: number,
	) => Effect.Effect<number | undefined, StorageError>
}
export type RateLimiter = ReturnType<typeof makeRateLimiter>

export const makeRateLimiter = ({ repository }: { repository: RateLimitRepository }) => {
	return {
		check: (key: string, limit: number, seconds = 60) =>
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
					return yield* new RateLimited({
						limit,
						reset: window + seconds,
						retryAfter: window + seconds - now,
					})
				return { limit, remaining: Math.max(0, limit - count), reset: window + seconds }
			}),
	}
}

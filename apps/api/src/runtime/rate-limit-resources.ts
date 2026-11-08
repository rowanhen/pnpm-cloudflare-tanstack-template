import type { Env } from '../env'
import { makeRateLimiter } from '../features/rate-limits/rate-limits'
import { rateLimitRepository } from '../features/rate-limits/repository'
export const rateLimiter = (env: Pick<Env, 'DB'>) =>
	makeRateLimiter({ repository: rateLimitRepository(env.DB) })

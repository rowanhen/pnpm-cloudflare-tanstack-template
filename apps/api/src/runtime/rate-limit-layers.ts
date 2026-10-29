import { Layer } from 'effect'
import type { Env } from '../env'
import { RateLimiterLive } from '../features/rate-limits/live'
import { rateLimitRepositoryLayer } from '../features/rate-limits/repository'
export const rateLimiterLayer = (env: Pick<Env, 'IDENTITY_DB'>) =>
	RateLimiterLive.pipe(Layer.provide(rateLimitRepositoryLayer(env.IDENTITY_DB)))

import { Layer } from 'effect'
import type { Env } from '../env'
import { IdentityCryptoLive } from '../identity-crypto'
import { WaitlistLive } from '../features/waitlist/live'
import { waitlistRepositoryLayer } from '../features/waitlist/repository'
import { emailLayer } from './email-layers'
import { rateLimiterLayer } from './rate-limit-layers'
export const waitlistLayer = (env: Env) =>
	WaitlistLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				waitlistRepositoryLayer(env.PRODUCT_DB),
				IdentityCryptoLive,
				emailLayer(env),
				rateLimiterLayer(env),
			),
		),
	)

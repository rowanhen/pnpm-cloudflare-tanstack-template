import { Layer } from 'effect'
import type { Env } from '../env'
import { EmailLive } from '../features/emails/live'
import { emailProviderLayer } from '../features/emails/provider'
import { emailRepositoryLayer } from '../features/emails/repository'
import { emailEnabled } from './configuration'
import { rateLimiterLayer } from './rate-limit-layers'
export const emailLayer = (env: Env) =>
	EmailLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				emailProviderLayer(env.EMAIL, env.EMAIL_FROM, emailEnabled(env)),
				emailRepositoryLayer(env.PRODUCT_DB),
				rateLimiterLayer(env),
			),
		),
	)

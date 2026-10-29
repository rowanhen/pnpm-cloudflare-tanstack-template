import { Layer } from 'effect'
import type { Env } from '../env'
import { IdentityCryptoLive } from '../identity-crypto'
import { StorefrontLive } from '../features/storefront/live'
import { StorefrontSettings } from '../features/storefront/service'
import { stripeLayer } from '../features/payments/stripe'
import { storefrontSettings } from './configuration'
import { rateLimiterLayer } from './rate-limit-layers'
export const storefrontLayer = (env: Env) =>
	StorefrontLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				Layer.succeed(StorefrontSettings, storefrontSettings(env)),
				IdentityCryptoLive,
				rateLimiterLayer(env),
				stripeLayer({ secretKey: env.STRIPE_SECRET_KEY, origin: env.AUTH_URL }),
			),
		),
	)

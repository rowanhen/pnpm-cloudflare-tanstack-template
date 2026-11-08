import type { Env } from '../env'
import { identityCrypto } from '../identity-crypto'
import { makeStorefront } from '../features/storefront/storefront'
import { stripeGateway } from '../features/payments/stripe'
import { storefrontSettings } from './configuration'
import { rateLimiter } from './rate-limit-resources'
export const storefront = (env: Env) =>
	makeStorefront({
		settings: storefrontSettings(env),
		crypto: identityCrypto,
		limiter: rateLimiter(env),
		gateway: stripeGateway({ secretKey: env.STRIPE_SECRET_KEY, origin: env.AUTH_URL }),
	})

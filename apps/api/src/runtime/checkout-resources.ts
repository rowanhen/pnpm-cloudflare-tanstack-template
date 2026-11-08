import type { Env } from '../env'
import { makeCheckout, makeCheckoutWebhook } from '../features/checkout/checkout'
import { checkoutRepository } from '../features/checkout/repository'
import { stripeGateway } from '../features/payments/stripe'
import { checkoutSettings } from './configuration'
import { rateLimiter } from './rate-limit-resources'
const dependencies = (env: Env) => ({
	settings: checkoutSettings(env),
	repository: checkoutRepository(env.DB, env.STRIPE_PRICE_ID ?? ''),
	gateway: stripeGateway({
		secretKey: env.STRIPE_SECRET_KEY,
		webhookSecret: env.STRIPE_WEBHOOK_SECRET,
		origin: env.AUTH_URL,
	}),
})
export const userCheckout = (env: Env, user: { id: string; email: string }) =>
	makeCheckout({
		...dependencies(env),
		limiter: rateLimiter(env),
		actor: { userId: user.id, email: user.email },
	})
export const checkoutWebhook = (env: Env) => makeCheckoutWebhook(dependencies(env))

import { Layer } from 'effect'
import type { Env } from '../env'
import { CheckoutLive, CheckoutWebhookLive } from '../features/checkout/live'
import { CheckoutActor, CheckoutSettings } from '../features/checkout/service'
import { checkoutRepositoryLayer } from '../features/checkout/repository'
import { stripeLayer } from '../features/payments/stripe'
import { checkoutSettings } from './configuration'
import { rateLimiterLayer } from './rate-limit-layers'
const dependencies = (env: Env) =>
	Layer.mergeAll(
		Layer.succeed(CheckoutSettings, checkoutSettings(env)),
		checkoutRepositoryLayer(env.BILLING_DB, env.STRIPE_PRICE_ID ?? ''),
		stripeLayer({
			secretKey: env.STRIPE_SECRET_KEY,
			webhookSecret: env.STRIPE_WEBHOOK_SECRET,
			origin: env.AUTH_URL,
		}),
	)
export const checkoutLayer = (env: Env, user: { id: string; email: string }) =>
	CheckoutLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				dependencies(env),
				rateLimiterLayer(env),
				Layer.succeed(CheckoutActor, { userId: user.id, email: user.email }),
			),
		),
	)
export const checkoutWebhookLayer = (env: Env) =>
	CheckoutWebhookLive.pipe(Layer.provide(dependencies(env)))

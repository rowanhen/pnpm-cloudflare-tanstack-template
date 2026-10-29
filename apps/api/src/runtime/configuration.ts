import type { Env } from '../env'
export const emailEnabled = (env: Pick<Env, 'EMAIL' | 'EMAIL_FROM'>) =>
	Boolean(env.EMAIL && env.EMAIL_FROM?.match(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/))
const testKeys = (env: Env) =>
	Boolean(
		env.STRIPE_SECRET_KEY?.match(/^(sk|rk)_test_/) &&
		env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_'),
	)
export const checkoutSettings = (env: Env) =>
	testKeys(env) && env.STRIPE_PRICE_ID && env.STRIPE_WEBHOOK_SECRET
		? {
				enabled: true as const,
				priceId: env.STRIPE_PRICE_ID,
				publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? '',
			}
		: { enabled: false as const }
export const storefrontSettings = (env: Env) =>
	testKeys(env) && env.STRIPE_DEMO_PRICE_ID && env.STRIPE_SUBSCRIPTION_PRICE_ID
		? {
				enabled: true as const,
				purchasePrice: env.STRIPE_DEMO_PRICE_ID,
				subscriptionPrice: env.STRIPE_SUBSCRIPTION_PRICE_ID,
				publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? '',
			}
		: { enabled: false as const }
export const publicConfiguration = (env: Env) => ({
	emailEnabled: emailEnabled(env),
	checkoutEnabled: checkoutSettings(env).enabled,
	googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
})

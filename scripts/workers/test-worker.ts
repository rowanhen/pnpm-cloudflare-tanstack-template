// Isolated Wrangler fixture only. Never referenced by the application deployment config.
import worker from '../../apps/api/src/index'
import type { Env } from '../../apps/api/src/env'
interface TestEnv extends Env {
	STRIPE_FIXTURE_URL: string
	POSTHOG_FIXTURE_URL: string
}
const originalFetch = globalThis.fetch
let fixtureOrigin: string | undefined
globalThis.fetch = (input, init) => {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
	if (new URL(url).origin === 'https://api.stripe.com') {
		if (!fixtureOrigin) throw new Error('Stripe fixture is not initialized')
		return originalFetch(url.replace('https://api.stripe.com', fixtureOrigin), init)
	}
	return originalFetch(input, init)
}
export default {
	fetch(request: Request, env: TestEnv, ctx: ExecutionContext) {
		fixtureOrigin = env.STRIPE_FIXTURE_URL
		if (request.headers.has('x-test-observability')) {
			env = {
				...env,
				POSTHOG_KEY: 'phc_worker_fixture',
				POSTHOG_HOST: env.POSTHOG_FIXTURE_URL,
				APP_ENV: 'test',
			}
			if (request.headers.get('x-test-observability') === 'error')
				env.DB = new Proxy(env.DB, {
					get() {
						throw new Error('private-exception')
					},
				})
		}
		if (
			new URL(request.url).pathname === '/api/auth/get-session' &&
			request.headers.get('x-test-session-failure') === 'true'
		)
			return new Response('Test upstream unavailable', { status: 503 })
		if (request.headers.get('x-test-email-failure') === 'true')
			env = {
				...env,
				EMAIL: {
					send: async () => {
						throw new Error('E_DELIVERY_FAILED test fixture')
					},
				},
			}
		if (request.headers.get('x-test-email-disabled') === 'true')
			env = { ...env, EMAIL_FROM: undefined }
		return worker.fetch(request, env, ctx)
	},
} satisfies ExportedHandler<TestEnv>

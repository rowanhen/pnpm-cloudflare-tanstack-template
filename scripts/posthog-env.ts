import { z } from 'zod'

// Collection tokens are public. Personal API keys are management credentials and
// must never be bundled into either frontend or deployed to the request Worker.
export function posthogEnv(env: NodeJS.ProcessEnv) {
	const key = env.POSTHOG_KEY ?? ''
	const host = env.POSTHOG_HOST ?? ''
	if (!key && !host) return { key: '', host: '', environment: env.APP_ENV ?? 'development' }
	if (!/^phc_[A-Za-z0-9_-]+$/.test(key))
		throw new Error('POSTHOG_KEY must be a public phc_ project token')
	const url = z.url().parse(host)
	if (!['https://eu.i.posthog.com', 'https://us.i.posthog.com'].includes(url))
		throw new Error('POSTHOG_HOST must be https://eu.i.posthog.com or https://us.i.posthog.com')
	return { key, host: url, environment: env.APP_ENV ?? 'development' }
}
export function posthogBuildEnv(env: NodeJS.ProcessEnv) {
	const config = posthogEnv(env)
	return {
		VITE_POSTHOG_KEY: config.key,
		VITE_POSTHOG_HOST: config.host,
		VITE_APP_ENV: config.environment,
	}
}

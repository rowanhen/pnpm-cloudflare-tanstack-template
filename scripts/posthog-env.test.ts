import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { posthogBuildEnv } from './posthog-env.ts'

describe('PostHog build settings', () => {
	test('when frontend builds include telemetry, only the public token is exposed', () => {
		assert.throws(() =>
			posthogBuildEnv({
				POSTHOG_KEY: 'phx_personal_secret',
				POSTHOG_HOST: 'https://eu.i.posthog.com',
			}),
		)
		assert.throws(() => posthogBuildEnv({ POSTHOG_KEY: 'phc_test' }))
		assert.deepEqual(
			posthogBuildEnv({
				POSTHOG_KEY: 'phc_test',
				POSTHOG_HOST: 'https://eu.i.posthog.com',
				POSTHOG_PERSONAL_API_KEY: 'phx_secret',
			}),
			{
				VITE_POSTHOG_KEY: 'phc_test',
				VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
				VITE_APP_ENV: 'development',
			},
		)
	})
})

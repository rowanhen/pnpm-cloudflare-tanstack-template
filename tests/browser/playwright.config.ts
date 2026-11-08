import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const env = {
	VITE_API_URL: 'http://localhost:8798',
	VITE_SITE_URL: 'http://localhost:3100',
	VITE_DASHBOARD_URL: 'http://localhost:3101',
	VITE_SITE_NAME: 'Cloudflare Starter',
	VITE_NOINDEX: 'true',
	VITE_APP_ENV: 'test',
	VITE_POSTHOG_KEY: '',
	VITE_POSTHOG_HOST: '',
}
export default defineConfig({
	testDir: '.',
	testMatch: '*.spec.ts',
	outputDir: '../../test-results',
	forbidOnly: Boolean(process.env.CI),
	workers: 1,
	retries: 0,
	timeout: 45_000,
	globalTimeout: 300_000,
	use: { browserName: 'chromium', baseURL: 'http://localhost:3101', trace: 'retain-on-failure' },
	webServer: [
		{ command: 'pnpm exec tsx tests/browser/worker.ts', url: 'http://localhost:8798/api/health' },
		{
			command: 'pnpm --filter dashboard exec vite dev --port 3101 --strictPort',
			url: 'http://localhost:3101/checkout',
		},
		{
			command: 'pnpm --filter marketing exec vite dev --port 3100 --strictPort',
			url: 'http://localhost:3100',
		},
	].map((server) => ({
		...server,
		cwd: root,
		env,
		reuseExistingServer: false,
		timeout: 120_000,
		gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 10_000 },
	})),
})

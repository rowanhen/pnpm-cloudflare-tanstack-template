import { defineConfig } from '@playwright/test'

const remoteApi = process.env.E2E_API_URL
const development = process.env.E2E_DEV === 'true'

export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	workers: 1,
	use: {
		baseURL: process.env.E2E_DASHBOARD_URL ?? 'http://localhost:3001',
		browserName: 'chromium',
	},
	webServer: process.env.E2E_DASHBOARD_URL
		? []
		: [
				{
					command: development
						? 'pnpm --filter dashboard dev'
						: 'pnpm --filter dashboard build && node scripts/preview.mjs dashboard 3001',
					url: 'http://localhost:3001/api/health',
					stdout: 'pipe',
					env: {
						VITE_API_URL: remoteApi ?? 'http://localhost:8787',
						E2E_PROXY_SECRET: process.env.E2E_PROXY_SECRET ?? '',
					},
					reuseExistingServer: false,
				},
				{
					command: development
						? 'pnpm --filter marketing dev'
						: 'pnpm --filter marketing build && node scripts/preview.mjs marketing 3000',
					url: 'http://localhost:3000',
					env: {
						VITE_API_URL: remoteApi ?? 'http://localhost:8787',
						VITE_SITE_URL: 'https://starter.example',
						VITE_NOINDEX: 'false',
						E2E_PROXY_SECRET: process.env.E2E_PROXY_SECRET ?? '',
					},
					reuseExistingServer: false,
				},
			],
})

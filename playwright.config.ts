import { defineConfig } from '@playwright/test'

const remoteApi = process.env.E2E_API_URL

export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	workers: 1,
	use: { baseURL: 'http://localhost:3001', browserName: 'chromium' },
	webServer: [
		...(remoteApi
			? []
			: [
					{
						command: 'pnpm db:migrate && pnpm --filter api dev',
						url: 'http://localhost:8787/api/health',
						reuseExistingServer: false,
					},
				]),
		{
			command: 'pnpm --filter dashboard build && pnpm --filter dashboard start --port 3001',
			url: 'http://localhost:3001',
			env: { VITE_API_URL: remoteApi ?? 'http://localhost:8787' },
			reuseExistingServer: false,
		},
		{
			command: 'pnpm --filter marketing build && pnpm --filter marketing start --port 3000',
			url: 'http://localhost:3000',
			reuseExistingServer: false,
		},
	],
})

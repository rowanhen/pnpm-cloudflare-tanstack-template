import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import wrangler from '../../apps/api/wrangler.json' with { type: 'json' }

const apiDirectory = fileURLToPath(new URL('../../apps/api/', import.meta.url).href)

export default defineConfig({
	plugins: [
		cloudflareTest({
			main: join(apiDirectory, wrangler.main),
			miniflare: {
				compatibilityDate: wrangler.compatibility_date,
				compatibilityFlags: wrangler.compatibility_flags,
				bindings: { ...wrangler.vars, BETTER_AUTH_SECRET: 'vitest-only-auth-secret' },
				d1Databases: wrangler.d1_databases.map(({ binding }) => binding),
				r2Buckets: wrangler.r2_buckets.map(({ binding }) => binding),
			},
		}),
	],
	test: { include: ['tests/workers/*.test.ts'], testTimeout: 30_000 },
})

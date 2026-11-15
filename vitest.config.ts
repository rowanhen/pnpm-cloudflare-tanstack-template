import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: [
			'tests/unit/*.test.ts',
			'apps/api/src/features/**/tests/*.test.ts',
			'apps/api/src/features/**/tests/*.test.tsx',
			'apps/api/src/contract/tests/*.test.ts',
			'apps/api/tests/*.test.ts',
			'apps/{dashboard,marketing}/src/**/*.test.ts',
			'apps/{dashboard,marketing}/src/**/*.test.tsx',
			'packages/*/src/**/*.test.ts',
			'packages/*/src/**/*.test.tsx',
			'scripts/*.test.ts',
			'tests/integration/local-worker.test.ts',
		],
		restoreMocks: true,
		testTimeout: 60_000,
		hookTimeout: 180_000,
	},
})

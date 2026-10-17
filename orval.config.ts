import { defineConfig } from 'orval'

const input = './packages/contracts/src/generated/openapi.json'

export default defineConfig({
	server: {
		input,
		output: {
			client: 'hono',
			mode: 'tags',
			target: './apps/api/src/generated/api.ts',
			override: {
				hono: { validator: false, handlerGenerationStrategy: 'skip' },
			},
		},
	},
	effect: {
		input,
		output: {
			client: 'effect',
			mode: 'tags',
			target: './packages/contracts/src/generated/api.effect.ts',
			fileExtension: '.effect.ts',
			override: {
				effect: {
					version: 4,
					generateEachHttpStatus: true,
					strict: { body: true, param: true, response: true },
				},
			},
		},
	},
	client: {
		input,
		output: {
			client: 'react-query',
			httpClient: 'fetch',
			mode: 'tags',
			target: './apps/dashboard/src/generated/api.ts',
			mock: { generators: [{ type: 'msw' }] },
			override: {
				query: { version: 5 },
				fetch: {
					includeHttpResponseReturnType: true,
					forceSuccessResponse: true,
					includeHttpErrorResponse: true,
				},
				mutator: { path: './apps/dashboard/src/lib/contract-fetch.ts', name: 'contractFetch' },
			},
		},
	},
})

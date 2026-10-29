import { defineConfig } from 'orval'
import { effectHandlers, effectHono, removeUnusedEffectModels } from './codegen/effect-handlers.ts'

const input = {
	target: './packages/contracts/openapi/api.json',
	parserOptions: { externalRefs: { allow: ['*'] } },
}

export default defineConfig({
	server: {
		input,
		output: {
			client: effectHono,
			clean: ['./apps/api/src/generated'],
			formatter: 'oxfmt',
			tsconfig: './apps/api/tsconfig.json',
			mode: 'tags',
			target: './apps/api/src/generated/api.ts',
			schemas: false,
			override: {
				hono: {
					validator: false,
					handlerGenerationStrategy: 'skip',
					compositeRoute: './apps/api/src/generated/routes.ts',
				},
			},
		},
	},
	effect: {
		input,
		hooks: { afterAllFilesWrite: removeUnusedEffectModels },
		output: {
			client: effectHandlers,
			clean: ['./packages/contracts/src/generated'],
			formatter: 'oxfmt',
			mode: 'tags',
			target: './packages/contracts/src/generated/api.effect.ts',
			fileExtension: '.effect.ts',
			override: {
				effect: {
					version: 4,
					generateEachHttpStatus: true,
					strict: { body: true, param: true, query: true, header: true, response: true },
				},
			},
		},
	},
	client: {
		input,
		output: {
			client: 'react-query',
			clean: ['./apps/dashboard/src/generated'],
			formatter: 'oxfmt',
			httpClient: 'fetch',
			headers: true,
			urlEncodeParameters: true,
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
	marketing: {
		input: { ...input, filters: { tags: ['waitlist'], mode: 'include' } },
		output: {
			client: 'fetch',
			httpClient: 'fetch',
			headers: true,
			urlEncodeParameters: true,
			mode: 'tags',
			target: './apps/marketing/src/generated/api.ts',
			clean: ['./apps/marketing/src/generated'],
			formatter: 'oxfmt',
			override: {
				fetch: {
					includeHttpResponseReturnType: true,
					forceSuccessResponse: true,
					includeHttpErrorResponse: true,
				},
				mutator: { path: './apps/marketing/src/lib/contract-fetch.ts', name: 'contractFetch' },
			},
		},
	},
})

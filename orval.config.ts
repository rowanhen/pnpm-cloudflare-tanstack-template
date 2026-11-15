import { defineConfig } from 'orval'
import { readFile, writeFile } from 'node:fs/promises'
import { effectHandlers, effectHono, removeUnusedEffectModels } from './codegen/effect-handlers.ts'

async function fixSchemaFactoryImports(paths: unknown) {
	if (!Array.isArray(paths)) throw new Error('Orval must supply generated paths to the hook')
	for (const path of paths) {
		if (typeof path !== 'string' || !path.endsWith('schemas.faker.ts')) continue
		const source = await readFile(path, 'utf8')
		if (source.includes("from './api.ts'")) {
			// Orval 8.48 resolves schema factories against api.ts in tags mode, which emits api.schemas.ts.
			await writeFile(path, source.replaceAll("from './api.ts'", "from './api.schemas.ts'"))
		} else if (!source.includes("from './api.schemas.ts'")) {
			throw new Error(`Unexpected schema factory type import in ${path}`)
		}
	}
}

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
		input: { ...input, filters: { tags: ['storefront'], mode: 'exclude' } },
		hooks: { afterAllFilesWrite: fixSchemaFactoryImports },
		output: {
			client: 'react-query',
			clean: ['./apps/dashboard/src/generated'],
			formatter: 'oxfmt',
			httpClient: 'fetch',
			headers: true,
			urlEncodeParameters: true,
			mode: 'tags',
			target: './apps/dashboard/src/generated/api.ts',
			mock: {
				indexMockFiles: true,
				fixtures: true,
				generators: [{ type: 'msw' }, { type: 'faker', schemas: true }],
			},
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
		input: { ...input, filters: { tags: ['waitlist', 'storefront'], mode: 'include' } },
		hooks: { afterAllFilesWrite: fixSchemaFactoryImports },
		output: {
			client: 'react-query',
			httpClient: 'fetch',
			headers: true,
			urlEncodeParameters: true,
			mode: 'tags',
			target: './apps/marketing/src/generated/api.ts',
			clean: ['./apps/marketing/src/generated'],
			formatter: 'oxfmt',
			mock: {
				indexMockFiles: true,
				fixtures: true,
				generators: [{ type: 'faker', schemas: true }],
			},
			override: {
				query: { version: 5 },
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

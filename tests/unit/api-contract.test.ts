import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))

async function fixture() {
	const directory = await mkdtemp(resolve(tmpdir(), 'contract-features-'))
	for (const file of [
		'packages/contracts/openapi',
		'packages/contracts/src/operation.ts',
		'orval.config.ts',
		'codegen',
		'package.json',
		'tsconfig.json',
		'.oxfmtrc.json',
		'apps/api/tsconfig.json',
		'apps/dashboard/src/lib/contract-fetch.ts',
		'apps/marketing/src/lib/contract-fetch.ts',
	]) {
		await mkdir(resolve(directory, file, '..'), { recursive: true })
		await cp(resolve(root, file), resolve(directory, file), { recursive: true })
	}
	await symlink(resolve(root, 'node_modules'), resolve(directory, 'node_modules'), 'dir')
	return directory
}

async function generatedFiles(directory: string) {
	const files: Record<string, string> = {}
	for (const folder of [
		'apps/api/src/generated',
		'packages/contracts/src/generated',
		'apps/dashboard/src/generated',
		'apps/marketing/src/generated',
	]) {
		const entries = await readdir(resolve(directory, folder), {
			recursive: true,
			withFileTypes: true,
		})
		for (const entry of entries) {
			if (!entry.isFile()) continue
			const path = resolve(entry.parentPath, entry.name)
			files[relative(directory, path)] = await readFile(path, 'utf8')
		}
	}
	return files
}

test('checked-in API output matches the spec and regeneration is deterministic', async (t) => {
	const directory = await fixture()
	t.after(() => rm(directory, { recursive: true, force: true }))
	const generate = () =>
		execFileSync('pnpm', ['exec', 'orval', '--config', 'orval.config.ts'], {
			cwd: directory,
			stdio: 'pipe',
		})
	generate()
	const first = await generatedFiles(directory)
	assert.deepEqual(
		await generatedFiles(root),
		first,
		'Generated API files are stale. Run pnpm api:generate and include every generated change.',
	)
	generate()
	assert.deepEqual(
		await generatedFiles(directory),
		first,
		'Regeneration must be byte-for-byte stable',
	)
})

const productFeature = {
	paths: {
		'/api/products/{id}': {
			get: {
				operationId: 'getProduct',
				tags: ['products'],
				security: [{ session: [] }],
				parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
				responses: {
					200: {
						description: 'Product',
						content: {
							'application/json': { schema: { $ref: '#/components/schemas/ProductResponse' } },
						},
					},
					404: {
						description: 'Missing product',
						content: {
							'application/json': { schema: { $ref: '#/components/schemas/ProductNotFound' } },
						},
					},
					...Object.fromEntries(
						Object.entries({
							400: 'BadRequest',
							401: 'Unauthorized',
							403: 'Forbidden',
							500: 'InternalError',
							503: 'Unavailable',
						}).map(([status, name]) => [
							status,
							{ $ref: `../shared/errors.json#/components/responses/${name}` },
						]),
					),
				},
			},
		},
	},
	components: {
		schemas: {
			ProductResponse: {
				type: 'object',
				required: ['product'],
				additionalProperties: false,
				properties: {
					product: {
						type: 'object',
						required: ['id'],
						additionalProperties: false,
						properties: { id: { type: 'string' } },
					},
				},
			},
			ProductNotFound: {
				type: 'object',
				required: ['code', 'error'],
				additionalProperties: false,
				properties: {
					code: { type: 'string', enum: ['product_not_found'] },
					error: { type: 'string' },
				},
			},
		},
	},
}

test('native Orval resolves a feature, preserves implementations and removes stale generated files', async (t) => {
	const directory = await fixture()
	t.after(() => rm(directory, { recursive: true, force: true }))
	const read = (file: string) => readFile(resolve(directory, file), 'utf8')
	const write = async (file: string, content: string) => {
		await mkdir(resolve(directory, file, '..'), { recursive: true })
		await writeFile(resolve(directory, file), content)
	}
	const generate = () =>
		execFileSync('pnpm', ['exec', 'orval', '--config', 'orval.config.ts'], {
			cwd: directory,
			stdio: 'pipe',
		})
	const entry = 'packages/contracts/openapi/api.json'
	const contract = JSON.parse(await read(entry))
	contract.paths['/api/products/{id}'] = {
		$ref: './features/products.json#/paths/~1api~1products~1{id}',
	}
	await write(entry, JSON.stringify(contract))
	await write('packages/contracts/openapi/features/products.json', JSON.stringify(productFeature))
	generate()
	assert.match(await read('apps/api/src/generated/storefront.handlers.ts'), /publicEffectHandler/)
	assert.doesNotMatch(await read('apps/api/src/generated/todos.handlers.ts'), /publicEffectHandler/)
	assert.match(
		await read('apps/api/src/features/storefront/get-storefront.ts'),
		/Handler<PublicApiRequest>/,
	)
	const implementation = 'apps/api/src/features/products/get-product.ts'
	assert.match(await read('apps/api/src/generated/routes.ts'), /from '\.\/products\.handlers'/)
	assert.match(
		await read('apps/api/src/generated/products.handlers.ts'),
		/features\/products\/get-product/,
	)
	assert.match(await read('packages/contracts/src/generated/operations.ts'), /GetProductHandler/)
	await assert.rejects(read('packages/contracts/src/generated/api.schemas.effect.ts'), {
		code: 'ENOENT',
	})
	assert.match(
		await read('packages/contracts/src/generated/products.effect.ts'),
		/product_not_found/,
	)
	assert.match(await read('apps/dashboard/src/generated/products.ts'), /useGetProduct/)
	assert.match(
		await read('apps/dashboard/src/generated/products/products.msw.ts'),
		/getGetProductMockHandler/,
	)
	assert.match(await read(implementation), /TODO_IMPLEMENT_OPERATION/)
	// Use only the generated product entry point to prove unfinished scaffolds fail normal typechecking.
	await write('apps/api/src/contract/context.ts', 'export type ApiRequest = never\n')
	await write(
		'tsconfig.fixture.json',
		JSON.stringify({
			compilerOptions: {
				strict: true,
				noEmit: true,
				target: 'ES2022',
				module: 'ESNext',
				moduleResolution: 'Bundler',
				skipLibCheck: true,
				types: [],
				paths: {
					'@workspace/contracts/operations': ['./packages/contracts/src/generated/operations.ts'],
				},
			},
			files: [implementation],
		}),
	)
	const typecheck = () =>
		spawnSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.fixture.json'], {
			cwd: directory,
			encoding: 'utf8',
		})
	const unfinished = typecheck()
	assert.notEqual(unfinished.status, 0)
	assert.match(unfinished.stdout + unfinished.stderr, /Cannot find name 'TODO_IMPLEMENT_OPERATION'/)
	const handwritten = `import { Effect } from 'effect'
import type { GetProductHandler } from '@workspace/contracts/operations'
import type { ApiRequest } from '../../contract/context'
export const getProduct: GetProductHandler<ApiRequest> = () => Effect.fail({status: 404, body: {code: 'product_not_found', error: 'Missing'}})
`
	await write(implementation, handwritten.replace("code: 'product_not_found'", "code: 'forbidden'"))
	const wrongStatusBody = typecheck()
	assert.notEqual(wrongStatusBody.status, 0)
	assert.match(wrongStatusBody.stdout + wrongStatusBody.stderr, /not assignable/)
	await write(implementation, handwritten)
	const implemented = typecheck()
	assert.equal(implemented.status, 0, implemented.stdout + implemented.stderr)
	generate()
	// Orval formats extraFiles when it first creates them, but must not touch handwritten files.
	assert.equal(await read(implementation), handwritten)
	delete contract.paths['/api/products/{id}']
	await write(entry, JSON.stringify(contract))
	generate()
	await assert.rejects(read('apps/api/src/generated/products.handlers.ts'), { code: 'ENOENT' })
	await assert.rejects(read('packages/contracts/src/generated/products.effect.ts'), {
		code: 'ENOENT',
	})
	await assert.rejects(read('apps/dashboard/src/generated/products.ts'), { code: 'ENOENT' })
	assert.equal(await read(implementation), handwritten)
})

test('the Effect extension rejects operations outside the supported boundary', async (t) => {
	const directory = await fixture()
	t.after(() => rm(directory, { recursive: true, force: true }))
	const source = resolve(directory, 'packages/contracts/openapi/features/todos.json')
	const original = JSON.parse(await readFile(source, 'utf8'))
	for (const [change, error] of [
		[
			(operation: Record<string, unknown>) => {
				operation.security = [{ unsupported: [] }]
			},
			/public, cookie-session, API-key or Stripe security/,
		],
		[
			(operation: Record<string, unknown>) => {
				Reflect.deleteProperty(operation.responses as object, '503')
			},
			/declare boundary response 503/,
		],
		[
			(operation: Record<string, unknown>) => {
				operation.parameters = [{ name: 'search', in: 'cookie', schema: { type: 'string' } }]
			},
			/only path, query and header parameters/,
		],
	] as const) {
		const feature = structuredClone(original)
		change(feature.paths['/api/todos'].get)
		await writeFile(source, JSON.stringify(feature))
		const result = spawnSync('pnpm', ['exec', 'orval', '--config', 'orval.config.ts'], {
			cwd: directory,
			encoding: 'utf8',
		})
		assert.match(result.stdout + result.stderr, error)
		assert.notEqual(result.status, 0, 'Invalid contracts must fail generation')
	}
})

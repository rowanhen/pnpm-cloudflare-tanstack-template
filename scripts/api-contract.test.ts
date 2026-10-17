import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assembleContract } from './api-contract.ts'
import { generateApi } from './generate-api.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

async function fixture() {
	const directory = await mkdtemp(resolve(tmpdir(), 'contract-features-'))
	await mkdir(resolve(directory, 'packages/contracts'), { recursive: true })
	await cp(
		resolve(root, 'packages/contracts/openapi'),
		resolve(directory, 'packages/contracts/openapi'),
		{ recursive: true },
	)
	return directory
}

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
						}).map(([status, name]) => [status, { $ref: `#/components/responses/${name}` }]),
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

test('discovers another feature and generates all outputs without router/config changes', async (t) => {
	const directory = await fixture()
	t.after(() => rm(directory, { recursive: true, force: true }))
	const source = resolve(directory, 'packages/contracts/openapi/features/products.json')
	await writeFile(source, JSON.stringify(productFeature))
	for (const file of [
		'orval.config.ts',
		'package.json',
		'tsconfig.json',
		'.oxfmtrc.json',
		'apps/dashboard/src/lib/contract-fetch.ts',
	]) {
		await mkdir(resolve(directory, file, '..'), { recursive: true })
		await cp(resolve(root, file), resolve(directory, file))
	}
	await symlink(resolve(root, 'node_modules'), resolve(directory, 'node_modules'), 'dir')
	const read = (file: string) => readFile(resolve(directory, file), 'utf8')
	await generateApi(directory)
	assert.match(await read('apps/api/src/generated/routes.ts'), /from '\.\/products'/)
	assert.match(
		await read('apps/api/src/generated/products.handlers.ts'),
		/features\/products\/get-product/,
	)
	assert.match(await read('packages/contracts/src/generated/operations.ts'), /GetProductHandler/)
	assert.match(
		await read('packages/contracts/src/generated/products.effect.ts'),
		/product_not_found/,
	)
	assert.match(await read('apps/dashboard/src/generated/products.ts'), /useGetProduct/)
	assert.match(
		await read('apps/dashboard/src/generated/products/products.msw.ts'),
		/getGetProductMockHandler/,
	)
	const implementation = 'apps/api/src/features/products/get-product.ts'
	assert.match(await read(implementation), /TODO_IMPLEMENT_OPERATION/)
	await assert.rejects(generateApi(directory, true), /Implement the operation entry points/)
	const handwritten = '// Handwritten implementation is never replaced.\n'
	await writeFile(resolve(directory, implementation), handwritten)
	await generateApi(directory)
	assert.equal(await read(implementation), handwritten)
	await rm(source)
	await generateApi(directory)
	await assert.rejects(read('apps/api/src/generated/products.ts'), { code: 'ENOENT' })
	assert.equal(await read(implementation), handwritten)
})

test('rejects duplicate paths, schemas, operation IDs, and mismatched feature tags', async (t) => {
	const directory = await fixture()
	t.after(() => rm(directory, { recursive: true, force: true }))
	const contract = resolve(directory, 'packages/contracts/openapi')
	const source = resolve(contract, 'features/products.json')
	for (const [fragment, error] of [
		[
			{ ...productFeature, paths: { '/api/todos': productFeature.paths['/api/products/{id}'] } },
			/Duplicate paths/,
		],
		[
			{ ...productFeature, components: { schemas: { Todo: { type: 'string' } } } },
			/Duplicate components\/schemas\/Todo/,
		],
		[
			{
				...productFeature,
				paths: {
					'/api/products': {
						get: { ...productFeature.paths['/api/products/{id}'].get, operationId: 'listTodos' },
					},
				},
			},
			/globally unique/,
		],
		[
			{
				...productFeature,
				paths: {
					'/api/products': {
						get: { ...productFeature.paths['/api/products/{id}'].get, tags: ['wrong'] },
					},
				},
			},
			/tag matching/,
		],
	] as const) {
		await writeFile(source, JSON.stringify(fragment))
		await assert.rejects(assembleContract(contract), error)
	}
})

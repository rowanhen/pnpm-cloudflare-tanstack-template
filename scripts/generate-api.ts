import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import SwaggerParser from '@apidevtools/swagger-parser'
import { generate } from 'orval'
import { assembleContract, contractMethods, operationFile } from './api-contract.ts'
import type { OpenAPIV3 } from 'openapi-types'

export async function generateApi(
	root = fileURLToPath(new URL('..', import.meta.url)),
	check = false,
) {
	const generatedDirectories = [
		'packages/contracts/src/generated',
		'apps/api/src/generated',
		'apps/dashboard/src/generated',
	]
	async function snapshot(base = root) {
		const files = new Map<string, string>()
		async function visit(directory: string) {
			for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
				const path = resolve(directory, entry.name)
				if (entry.isDirectory()) await visit(path)
				else files.set(relative(base, path), await readFile(path, 'utf8'))
			}
		}
		for (const directory of generatedDirectories) await visit(resolve(base, directory))
		return files
	}
	const before = await snapshot()
	const { document: bundled, features } = await assembleContract(
		resolve(root, 'packages/contracts/openapi'),
	)
	await SwaggerParser.validate(structuredClone(bundled))
	const document = (await SwaggerParser.dereference(structuredClone(bundled))) as OpenAPIV3.Document
	const featureFor = new Map(
		features.flatMap((feature) => feature.operations.map((id) => [id, feature.name] as const)),
	)
	const methods = contractMethods
	const operations: {
		id: string
		feature: string
		name: string
		method: string
		path: string
		hasBody: boolean
		input: string
		responses: string
		errorCodes: string
	}[] = []
	const seen = new Set<string>()
	for (const [path, item] of Object.entries(document.paths)) {
		if (!item || '$ref' in item) throw new Error(`Unsupported path reference: ${path}`)
		for (const method of methods) {
			const operation = item[method]
			if (!operation) continue
			const id = operation.operationId
			if (!id || !/^[a-z][a-zA-Z0-9]*$/.test(id) || seen.has(id))
				throw new Error(`Each operation needs a unique camelCase operationId: ${path}`)
			seen.add(id)
			const feature = featureFor.get(id)
			if (!feature) throw new Error(`No feature owns ${id}`)
			const name = id[0].toUpperCase() + id.slice(1)
			if (
				JSON.stringify(operation.security ?? document.security) !==
				JSON.stringify([{ session: [] }])
			)
				throw new Error(`${id}: this adapter requires cookie-session security`)
			const input: string[] = []
			const parameters = [...(item.parameters ?? []), ...(operation.parameters ?? [])]
			if (parameters.some((p) => '$ref' in p || p.in !== 'path'))
				throw new Error(`${id}: extend the companion generator before using non-path parameters`)
			if (parameters.length) input.push(`params: S.${name}Params`)
			if (operation.requestBody) {
				if ('$ref' in operation.requestBody)
					throw new Error(`${id}: use an inline JSON requestBody`)
				if (!operation.requestBody.required)
					throw new Error(`${id}: optional request bodies need adapter support`)
				const schema = operation.requestBody.content['application/json']?.schema
				if (!schema) throw new Error(`${id}: only JSON request bodies are supported`)
				const resolved =
					'$ref' in schema
						? document.components?.schemas?.[schema.$ref.split('/').at(-1) ?? '']
						: schema
				// Orval currently omits minProperties; retain this contract constraint in the boundary schema.
				const minimum = resolved && !('$ref' in resolved) ? resolved.minProperties : undefined
				input.push(
					`body: S.${name}Body${minimum === undefined ? '' : `.check(Schema.isMinProperties(${minimum}))`}`,
				)
			}
			const errorCodes: string[] = []
			for (const status of [
				'400',
				'401',
				'403',
				'500',
				'503',
				...(operation.requestBody ? ['413', '415'] : []),
			]) {
				if (!operation.responses[status])
					throw new Error(`${id}: declare boundary response ${status}`)
			}
			const responses = Object.entries(operation.responses).map(([status, response]) => {
				if (!/^[245][0-9]{2}$/.test(status) || '$ref' in response)
					throw new Error(`${id}: use explicit 2xx/4xx/5xx statuses and inline responses`)
				const json = response.content?.['application/json']
				if (response.content && !json) throw new Error(`${id}: only JSON responses are supported`)
				if (!json && status !== '204') throw new Error(`${id}: only 204 may omit a response body`)
				if (Number(status) >= 400) {
					const schema = json?.schema
					const resolved =
						schema && '$ref' in schema
							? document.components?.schemas?.[schema.$ref.split('/').at(-1) ?? '']
							: schema
					const code = resolved && !('$ref' in resolved) ? resolved.properties?.code : undefined
					if (
						!code ||
						'$ref' in code ||
						code.enum?.length !== 1 ||
						typeof code.enum[0] !== 'string'
					)
						throw new Error(`${id}/${status}: errors require a singleton string code enum`)
					errorCodes.push(`${status}: ${JSON.stringify(code.enum[0])}`)
				}
				return `${status}: ${json ? `S.${name}${status}Response` : 'Schema.Undefined'}`
			})
			operations.push({
				id,
				feature,
				name,
				method,
				path,
				hasBody: Boolean(operation.requestBody),
				input: input.join(',\n'),
				responses: responses.join(',\n'),
				errorCodes: errorCodes.join(',\n'),
			})
		}
	}

	const stage = await mkdtemp(join(tmpdir(), 'template-api-generation-'))
	try {
		// Mirror only the inputs Orval needs. Generated imports retain the real project's relative layout.
		for (const file of [
			'apps/dashboard/src/lib/contract-fetch.ts',
			'package.json',
			'tsconfig.json',
		]) {
			await mkdir(resolve(stage, file, '..'), { recursive: true })
			await copyFile(resolve(root, file), resolve(stage, file))
		}
		await mkdir(resolve(stage, 'packages/contracts/src/generated'), { recursive: true })
		await writeFile(
			resolve(stage, 'packages/contracts/src/generated/openapi.json'),
			JSON.stringify(bundled, null, 2) + '\n',
		)
		await generate(resolve(root, 'orval.config.ts'), stage, { throwOnError: true })
		const header = '// Generated from openapi/features by scripts/generate-api.ts. Do not edit.\n'
		const contracts = `${header}
import { Schema } from 'effect'
import type { Handler, InputOf, SuccessOf, FailureOf } from '../operation'
${features.map((feature) => `import * as ${feature.name.replace(/-/g, '_')}Schemas from './${feature.name}.effect'`).join('\n')}
${operations
	.map(
		({ id, name, method, path, feature, hasBody, input, responses, errorCodes }) => `
export const ${id} = {
 operationId: '${id}', method: '${method.toUpperCase()}', path: ${JSON.stringify(path)},
 hasBody: ${hasBody},
 input: Schema.Struct({${input.replace(/S\./g, feature.replace(/-/g, '_') + 'Schemas.')}}),
 responses: {${responses.replace(/S\./g, feature.replace(/-/g, '_') + 'Schemas.')}},
 errorCodes: {${errorCodes}},
} as const
export type ${name}Input = InputOf<typeof ${id}>
export type ${name}Success = SuccessOf<typeof ${id}>
export type ${name}Failure = FailureOf<typeof ${id}>
export type ${name}Handler<R = never> = Handler<typeof ${id}, R>
`,
	)
	.join('\n')}
export const operations = [${operations.map(({ id }) => id).join(', ')}] as const
`
		await writeFile(resolve(stage, 'packages/contracts/src/generated/operations.ts'), contracts)
		for (const feature of features) {
			await writeFile(
				resolve(stage, `apps/api/src/generated/${feature.name}.handlers.ts`),
				`${header}
import { createFactory } from 'hono/factory'
import * as operations from '@workspace/contracts/operations'
import { effectHandler } from '../contract/handler'
${feature.operations.map((id) => `import { ${id} } from '../features/${feature.name}/${operationFile(id)}'`).join('\n')}
const factory = createFactory()
${feature.operations.map((id) => `export const ${id}Handlers = factory.createHandlers(effectHandler(operations.${id}, ${id}))`).join('\n')}
`,
			)
		}
		await writeFile(
			resolve(stage, 'apps/api/src/generated/routes.ts'),
			`${header}
import { Hono } from 'hono'
${features.map((feature, index) => `import feature${index} from './${feature.name}'`).join('\n')}
export default new Hono()${features.map((_, index) => `.route('/', feature${index})`).join('')}
`,
		)
		// Effect performs validation for all statuses; stock Hono validators and transport models are unused.
		for (const file of await readdir(resolve(stage, 'apps/api/src/generated'))) {
			if (/\.(zod|validator|context|schemas)\.ts$/.test(file))
				await rm(resolve(stage, 'apps/api/src/generated', file))
		}
		execFileSync(
			'pnpm',
			[
				'exec',
				'oxfmt',
				...generatedDirectories.map((directory) => resolve(stage, directory)),
				'--config',
				resolve(root, '.oxfmtrc.json'),
				'--write',
			],
			{
				cwd: root,
				stdio: 'pipe',
			},
		)
		const after = await snapshot(stage)
		const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
			(file) => before.get(file) !== after.get(file),
		)
		const missing: string[] = []
		const created: string[] = []
		for (const operation of operations) {
			const file = `apps/api/src/features/${operation.feature}/${operationFile(operation.id)}.ts`
			const content = await readFile(resolve(root, file), 'utf8').catch(() => undefined)
			if (content?.includes('TODO_IMPLEMENT_OPERATION') || content === undefined) missing.push(file)
			if (!check && content === undefined) {
				await mkdir(resolve(root, file, '..'), { recursive: true })
				await writeFile(
					resolve(root, file),
					`import { Effect } from 'effect'\nimport type { ${operation.name}Handler } from '@workspace/contracts/operations'\nimport type { ApiRequest } from '../../contract/context'\n\n// TODO_IMPLEMENT_OPERATION: replace this stub with the business logic.\nexport const ${operation.id}: ${operation.name}Handler<ApiRequest> = () => Effect.die(new Error('Implement ${operation.id}'))\n`,
					{ flag: 'wx' },
				)
				created.push(file)
			}
		}
		if (created.length)
			execFileSync('pnpm', ['exec', 'oxfmt', ...created, '--write'], { cwd: root, stdio: 'pipe' })
		if (!check && missing.length)
			console.log(
				`Implement the new operation entry points before CI can pass:\n${missing.join('\n')}`,
			)
		if (check && missing.length)
			throw new Error(
				`Implement the operation entry points before CI can pass:\n${missing.join('\n')}`,
			)
		if (check && changed.length)
			throw new Error(`Generated API is stale. Run pnpm api:generate:\n${changed.join('\n')}`)
		if (!check) {
			// Publish only completed, changed outputs; never delete a directory watched by Vite/Wrangler.
			for (const [file, content] of after) {
				if (before.get(file) === content) continue
				await mkdir(resolve(root, file, '..'), { recursive: true })
				const pending = resolve(root, `${file}.next`)
				await writeFile(pending, content)
				await rename(pending, resolve(root, file))
			}
			for (const file of before.keys()) if (!after.has(file)) await rm(resolve(root, file))
		}
		console.log(
			check
				? 'Generated API matches the OpenAPI contract.'
				: 'Generated Hono routes, Effect contracts, and frontend client.',
		)
	} finally {
		await rm(stage, { recursive: true, force: true })
	}
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	await generateApi(undefined, process.argv.includes('--check'))
}

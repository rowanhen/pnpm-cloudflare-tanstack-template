import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { OpenAPIV3 } from 'openapi-types'

export const contractMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const
export const operationFile = (id: string) =>
	id
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
		.toLowerCase()

type Fragment = Pick<OpenAPIV3.Document, 'paths' | 'components'>
export interface ContractFeature {
	name: string
	operations: string[]
}

// Plain OpenAPI fragments share the assembled document's #/components namespace.
export async function assembleContract(directory: string) {
	const read = async (file: string) => JSON.parse(await readFile(resolve(directory, file), 'utf8'))
	const document = (await read('api.json')) as OpenAPIV3.Document
	const features: ContractFeature[] = []
	const owners = new Map<string, string>()
	function merge(fragment: Fragment, file: string) {
		if (Object.keys(fragment).some((key) => !['paths', 'components'].includes(key)))
			throw new Error(`${file}: feature/shared fragments contain only paths and components`)
		for (const [path, item] of Object.entries(fragment.paths ?? {})) {
			const key = `paths/${path}`
			if (Object.hasOwn(document.paths, path))
				throw new Error(`Duplicate ${key} in ${file} and ${owners.get(key) ?? 'api.json'}`)
			document.paths[path] = item
			owners.set(key, file)
		}
		for (const [group, entries] of Object.entries(fragment.components ?? {})) {
			const components = (document.components ??= {})
			const target = ((components as Record<string, Record<string, unknown>>)[group] ??= {})
			for (const [name, value] of Object.entries(entries)) {
				const key = `components/${group}/${name}`
				if (Object.hasOwn(target, name))
					throw new Error(`Duplicate ${key} in ${file} and ${owners.get(key) ?? 'api.json'}`)
				target[name] = value
				owners.set(key, file)
			}
		}
	}
	for (const file of (await readdir(resolve(directory, 'shared')))
		.filter((entry) => entry.endsWith('.json'))
		.sort()) {
		const fragment = (await read(`shared/${file}`)) as Fragment
		if (Object.keys(fragment.paths ?? {}).length)
			throw new Error(`shared/${file}: routes belong in features/`)
		merge(fragment, `shared/${file}`)
	}
	const ids = new Set<string>()
	for (const file of (await readdir(resolve(directory, 'features')))
		.filter((entry) => entry.endsWith('.json'))
		.sort()) {
		const name = file.slice(0, -5)
		if (
			!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name) ||
			['api', 'routes', 'operations', 'default'].includes(name)
		)
			throw new Error(`Use a non-reserved kebab-case feature filename: ${file}`)
		const fragment = (await read(`features/${file}`)) as Fragment
		const operations: string[] = []
		for (const [path, item] of Object.entries(fragment.paths ?? {})) {
			if (!item || '$ref' in item) throw new Error(`${file}: define path items inline`)
			for (const method of contractMethods) {
				const operation = item[method]
				if (!operation) continue
				const id = operation.operationId
				if (!id || !/^[a-z][a-zA-Z0-9]*$/.test(id) || ids.has(id))
					throw new Error(`${file}: each operation needs a globally unique camelCase operationId`)
				if (operation.tags?.length !== 1 || operation.tags[0] !== name)
					throw new Error(
						`${method.toUpperCase()} ${path}: use exactly one tag matching ${file}: '${name}'`,
					)
				ids.add(id)
				operations.push(id)
			}
		}
		if (!operations.length) throw new Error(`${file}: a feature must define at least one operation`)
		merge(fragment, `features/${file}`)
		features.push({ name, operations })
	}
	if (!features.length) throw new Error('Define at least one feature in openapi/features/')
	return { document, features }
}

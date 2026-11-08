import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { checkArchitecture } from '../../scripts/check-architecture.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))

test('backend syntax lint rejects unsafe types without enforcing feature filenames', async (t) => {
	const directory = await mkdtemp(join(tmpdir(), 'backend-boundaries-'))
	t.after(() => rm(directory, { recursive: true, force: true }))
	await writeFile(join(directory, '.oxlintrc.json'), await readFile(join(root, '.oxlintrc.json')))
	const cases = [
		['domain.ts', 'export const unsafe = (value: any) => value', false],
		['domain.ts', 'export const unsafe = (value: string | undefined) => value!', false],
		['repository.ts', 'export const value = 1', true],
	] as const
	for (const [index, [file, source, allowed]] of cases.entries()) {
		await t.test(`${allowed ? 'allows' : 'rejects'} ${source}`, async () => {
			const path = join('apps/api/src/features', `example-${index}`, file)
			await mkdir(dirname(join(directory, path)), { recursive: true })
			await writeFile(join(directory, path), source)
			const result = spawnSync(
				process.execPath,
				[join(root, 'node_modules/oxlint/bin/oxlint'), path],
				{
					cwd: directory,
					encoding: 'utf8',
				},
			)
			assert.ifError(result.error)
			assert.equal(result.status, allowed ? 0 : 1, result.stdout + result.stderr)
		})
	}
})

test('architecture graph rejects hidden dependencies, cycles and direct D1 while allowing adapters', async (t) => {
	const directory = await mkdtemp(join(tmpdir(), 'architecture-graph-'))
	t.after(() => rm(directory, { recursive: true, force: true }))
	const files: Record<string, string> = {
		'apps/api/tsconfig.json': JSON.stringify({
			compilerOptions: { strict: true, target: 'es2022', skipLibCheck: true },
			include: ['src/**/*.ts'],
		}),
		'apps/api/src/generated/routes.ts': "import '../features/sample/get-sample'",
		'apps/api/src/features/sample/get-sample.ts':
			"import { bad } from './repository'; export const route = bad",
		'apps/api/src/features/sample/sample.ts':
			'export const makeSample = (value: number) => ({ value })',
		'apps/api/src/features/other/workflow.ts':
			"import { makeSample } from '../sample/sample'; export const example = makeSample(1)",
		'apps/api/src/features/sample/service.ts': 'export const service = 1',
		'apps/api/src/features/sample/repository.ts':
			"interface D1Database { batch(items: string[]): Promise<void>; prepare(sql: string): void; exec(sql: string): void }; export const bad = (db: D1Database) => { const alias = db; alias.batch([]); db['prepare']('sql'); db.exec('sql'); const { batch: directBatch } = db; directBatch([]) }; export const mapped = (db: Readonly<D1Database>) => db.batch([]); export const picked = (db: Pick<D1Database, 'exec'>) => db.exec('sql'); export const parameter = ({ batch }: D1Database) => batch([])",
		'apps/api/src/features/sample/create-internal.ts':
			"import { service } from '../other/repository'; export const result = service; export const now = globalThis['Date'].now(); const Effect = { runPromise: () => 1 }; const { runPromise: execute } = Effect; execute()",
		'apps/api/src/features/sample/hidden.ts': "export { result } from './create-internal'",
		'apps/api/src/features/sample/a.ts': "export { b } from './b'; export const a = 1",
		'apps/api/src/features/sample/b.ts': "export { a } from './a'; export const b = 2",
		'apps/api/src/features/other/repository.ts': 'export const service = 2',
		'apps/api/src/features/other/provider.ts': "export { bad } from '../sample/repository.js'",
	}
	for (const [file, source] of Object.entries(files)) {
		await mkdir(dirname(join(directory, file)), { recursive: true })
		await writeFile(join(directory, file), source)
	}
	let errors = checkArchitecture(directory)
	assert.equal(errors.filter((error) => error.includes('direct D1')).length, 7, errors.join('\n'))
	assert.ok(
		errors.some((error) => error.includes('cross-feature imports')),
		errors.join('\n'),
	)
	assert.ok(
		errors.some((error) => error.includes('other/provider.ts') && error.includes('cross-feature')),
		errors.join('\n'),
	)
	assert.ok(
		errors.some((error) => error.includes('dependency cycle')),
		errors.join('\n'),
	)
	assert.ok(
		errors.some((error) => error.includes('execute Effects at hosts')),
		errors.join('\n'),
	)
	assert.ok(
		errors.some((error) => error.includes('ambient I/O')),
		errors.join('\n'),
	)
	await writeFile(
		join(directory, 'apps/api/src/features/sample/repository.ts'),
		"export const regex = /ok/.exec('ok'); interface DrizzleD1Database { batch(items: string[]): Promise<void> }; export const query = (db: DrizzleD1Database) => db.batch([])",
	)
	await writeFile(
		join(directory, 'apps/api/src/features/sample/create-internal.ts'),
		"export { service } from './service'",
	)
	await writeFile(
		join(directory, 'apps/api/src/features/sample/hidden.ts'),
		"export { service } from './service'",
	)
	await writeFile(join(directory, 'apps/api/src/features/sample/b.ts'), 'export const b = 2')
	await writeFile(
		join(directory, 'apps/api/src/features/other/provider.ts'),
		'export const provider = 1',
	)
	await writeFile(
		join(directory, 'apps/api/src/features/sample/get-sample.ts'),
		"import { query } from './repository'; export const route = query",
	)
	errors = checkArchitecture(directory)
	assert.deepEqual(errors, [])
})

test('feature boundaries survive renames and allow cohesive adapters without checker changes', async (t) => {
	const directory = await mkdtemp(join(tmpdir(), 'architecture-roles-'))
	t.after(() => rm(directory, { recursive: true, force: true }))
	const files = {
		'apps/api/tsconfig.json': JSON.stringify({
			compilerOptions: { strict: true, target: 'es2022' },
			include: ['src/**/*.ts'],
		}),
		'apps/api/src/generated/routes.ts': "import '../features/example/entry'",
		'apps/api/src/features/example/entry.ts': "export { query } from './adapters/orders'",
		'apps/api/src/features/example/adapters/orders.ts':
			"import { Effect } from 'effect'; export const query = () => Effect.tryPromise(() => Promise.resolve(Date.now()))",
		'apps/api/src/features/example/rules.ts': 'export const limit = 10',
	}
	for (const [path, source] of Object.entries(files)) {
		await mkdir(dirname(join(directory, path)), { recursive: true })
		await writeFile(join(directory, path), source)
	}
	assert.deepEqual(checkArchitecture(directory), [])
	const violations = [
		["export { query } from './adapters/orders'", 'application code'],
		["export { database } from '@workspace/data/client'", 'pure public contract'],
		["export { runPromise } from 'effect/Effect'", 'pure public contract'],
		['export const now = Date.now()', 'ambient I/O'],
		["export const request = fetch('/')", 'ambient I/O'],
		["import { Effect } from 'effect'; export const run = Effect.runPromise", 'execute Effects'],
		["import { Effect } from 'effect'; export const run = Effect.tryPromise", 'execute Effects'],
	] as const
	for (const [source, message] of violations) {
		await writeFile(join(directory, 'apps/api/src/features/example/rules.ts'), source)
		assert.ok(
			checkArchitecture(directory).some((error) => error.includes(message)),
			source,
		)
	}
})

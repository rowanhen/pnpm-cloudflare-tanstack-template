import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { checkArchitecture } from '../../scripts/check-architecture.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))

test('backend lint rules reject boundary violations and allow adapters', async (t) => {
	const directory = await mkdtemp(join(tmpdir(), 'backend-boundaries-'))
	t.after(() => rm(directory, { recursive: true, force: true }))
	await writeFile(join(directory, '.oxlintrc.json'), await readFile(join(root, '.oxlintrc.json')))
	const cases = [
		['service.ts', "import type { Context } from 'hono'; export type Request = Context", false],
		['domain.ts', "export { productDatabase } from '@workspace/data/client'", false],
		[
			'live.ts',
			"import { TodoRepository } from './repository'; export const repo = TodoRepository",
			false,
		],
		[
			'live.ts',
			"import { ApiRequest } from '../../contract/context'; export const request = ApiRequest",
			false,
		],
		['live.ts', "import { env } from 'node:process'; export const value = env.KEY", false],
		['live.ts', "export { runPromise } from 'effect/Effect'", false],
		['domain.ts', "export { getTodo } from '@workspace/contracts/operations'", false],
		[
			'live.ts',
			"import { Effect } from 'effect'; export const value = Effect.tryPromise(() => Promise.resolve(1))",
			false,
		],
		['live.ts', "import { Effect as Fx } from 'effect'; export const run = Fx.runPromise", false],
		['live.ts', 'export const secret = process.env.API_KEY', false],
		['live.ts', 'export const now = Date.now()', false],
		['live.ts', "export const request = globalThis.fetch('/')", false],
		['domain.ts', 'export const unsafe = (value: any) => value', false],
		['domain.ts', 'export const unsafe = (value: string | undefined) => value!', false],
		['live.ts', "export const request = fetch('/')", false],
		[
			'repository.ts',
			"import { Effect } from 'effect'; export const query = Effect.tryPromise(() => Promise.resolve(1))",
			true,
		],
		[
			'get-example.ts',
			"import { Effect } from 'effect'; export const run = Effect.runPromise",
			true,
		],
		[
			'service.ts',
			"import { Context } from 'effect'; export class Example extends Context.Service<Example, { readonly value: string }>()('Example') {}",
			true,
		],
		[
			'live.ts',
			"import { TodoService } from '../todos/service'; export const dependency = TodoService",
			true,
		],
		['domain.ts', "export { TodoData } from '@workspace/contracts/todos'", true],
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
		'apps/api/src/features/sample/get-sample.ts': 'export const route = 1',
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
	errors = checkArchitecture(directory)
	assert.deepEqual(errors, [])
})

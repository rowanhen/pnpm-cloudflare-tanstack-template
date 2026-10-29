import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

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
		['domain.ts', "export { getTodo } from '@workspace/contracts/operations'", false],
		[
			'live.ts',
			"import { Effect } from 'effect'; export const value = Effect.tryPromise(() => fetch('/'))",
			false,
		],
		['live.ts', "import { Effect as Fx } from 'effect'; export const run = Fx.runPromise", false],
		['live.ts', 'export const secret = process.env.API_KEY', false],
		['live.ts', 'export const now = Date.now()', false],
		['live.ts', "export const request = globalThis.fetch('/')", false],
		['domain.ts', 'export const unsafe = (value: any) => value!', false],
		['repository.ts', 'export const query = (db: { prepare: Function }) => db.prepare()', false],
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

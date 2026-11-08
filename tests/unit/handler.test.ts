import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { Cause, Effect } from 'effect'
import { Hono } from 'hono'
import { getTodo, type GetTodoFailure } from '../../packages/contracts/src/generated/operations.ts'
import { publicEffectHandler } from '../../apps/api/src/contract/handler.ts'
import { StorageError } from '../../apps/api/src/persistence.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))
const missing = {
	status: 404,
	body: { code: 'todo_not_found', error: 'Todo not found' },
} satisfies GetTodoFailure

test('HTTP boundary reports storage failures and preserves fatal causes during typed recovery', async () => {
	for (const [program, expectedStatus] of [
		[Effect.fail(missing), 404],
		[Effect.fail(new StorageError({ cause: 'private database detail' })), 500],
	] as const) {
		let reported = false
		const app = new Hono()
		app.onError((_error, c) => {
			reported = true
			return c.json({ error: 'Internal error' }, 500)
		})
		app.get(
			'/api/todos/:id',
			publicEffectHandler(getTodo, () => program),
		)
		const response = await app.request('/api/todos/missing')
		assert.equal(response.status, expectedStatus)
		assert.equal(reported, expectedStatus === 500)
		assert.deepEqual(
			await response.json(),
			expectedStatus === 404 ? missing.body : { error: 'Internal error' },
		)
	}
	for (const reason of [Cause.makeDieReason(new Error('defect')), Cause.makeInterruptReason()]) {
		const app = new Hono()
		const program = Effect.failCause(Cause.fromReasons([Cause.makeFailReason(missing), reason]))
		app.get(
			'/api/todos/:id',
			publicEffectHandler(getTodo, () => program),
		)
		// Mixed fatal causes escape to the host; they must never become an ordinary 404 response.
		await assert.rejects(
			Promise.resolve(app.request('/api/todos/missing')),
			(error: unknown) => error === missing,
		)
	}
})

test('HTTP adapter accepts storage failures but rejects unmapped domain errors and wrong response bodies', async (t) => {
	const directory = await mkdtemp(join(tmpdir(), 'handler-types-'))
	t.after(() => rm(directory, { recursive: true, force: true }))
	await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')
	await writeFile(
		join(directory, 'tsconfig.json'),
		JSON.stringify({
			extends: join(root, 'apps/api/tsconfig.json'),
			compilerOptions: { allowImportingTsExtensions: true },
			include: ['handler.ts'],
		}),
	)
	const imports = `import { Effect } from 'effect'
import { getTodo } from '${root}/packages/contracts/src/generated/operations.ts'
import { effectHandler } from '${root}/apps/api/src/contract/handler.ts'
import { StorageError } from '${root}/apps/api/src/persistence.ts'
import { TodoNotFound } from '${root}/apps/api/src/features/todos/todos.ts'
void StorageError; void TodoNotFound
`
	for (const [failure, valid] of [
		["new StorageError({ cause: 'database failure' })", true],
		['new TodoNotFound()', false],
		["{ status: 404, body: { code: 'forbidden', error: 'Wrong code' } }", false],
	] as const) {
		await writeFile(
			join(directory, 'handler.ts'),
			imports + `effectHandler(getTodo, () => Effect.fail(${failure}))`,
		)
		const result = spawnSync('pnpm', ['exec', 'tsc', '-p', join(directory, 'tsconfig.json')], {
			cwd: root,
			encoding: 'utf8',
		})
		assert.ifError(result.error)
		if (valid) assert.equal(result.status, 0, result.stdout + result.stderr)
		else {
			assert.notEqual(result.status, 0)
			assert.match(result.stdout + result.stderr, /not assignable/)
		}
	}
})

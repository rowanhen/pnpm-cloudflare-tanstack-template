import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Effect } from 'effect'
import type { Todo } from '@workspace/contracts'
import { makeTodos, type TodoRepository } from '../todos.ts'
import { InvalidInput, MissingRecord } from '../../../errors.ts'
import { StorageError } from '../../../persistence.ts'

const todo: Todo = {
	id: 'one',
	title: 'Example',
	completed: false,
	created_at: '2026-10-29T10:00:00Z',
}
function fixture(overrides: Partial<TodoRepository> = {}) {
	const writes: unknown[] = []
	const repository: TodoRepository = {
		list: Effect.succeed([todo]),
		find: (id) => Effect.succeed(id === todo.id ? todo : undefined),
		create: (title) =>
			Effect.sync(() => {
				writes.push(title)
				return { ...todo, title }
			}),
		update: (id, change) =>
			Effect.sync(() => {
				writes.push(change)
				return id === todo.id ? { ...todo, ...change } : undefined
			}),
		remove: (id) => Effect.succeed(id === todo.id),
		...overrides,
	}
	return { writes, todos: makeTodos(repository) }
}
describe('todo workflows', () => {
	test('when todo changes are valid, the workflow persists trimmed partial updates', async () => {
		const { writes, todos } = fixture()
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const created = yield* todos.create('  New task  ')
				const updated = yield* todos.update('one', { completed: false })
				const renamed = yield* todos.update('one', { title: '  Renamed  ', completed: true })
				return { created, updated, renamed, listed: yield* todos.list }
			}),
		)
		assert.equal(result.created.title, 'New task')
		assert.equal(result.updated.title, 'Example')
		assert.equal(result.updated.completed, false)
		assert.equal(result.renamed.title, 'Renamed')
		assert.equal(result.renamed.completed, true)
		assert.deepEqual(result.listed, [todo])
		assert.deepEqual(writes, [
			'New task',
			{ completed: false },
			{ title: 'Renamed', completed: true },
		])
	})

	test('when todo input is invalid, writes are rejected', async () => {
		const { writes, todos } = fixture()
		const unexpected = { completed: true, user_id: 'another-user' }
		const programs = [
			todos.create('   '),
			todos.create('x'.repeat(201)),
			todos.update('one', {}),
			todos.update('one', { title: '   ' }),
			todos.update('one', unexpected),
		]
		for (const program of programs) {
			const result = await Effect.runPromise(program.pipe(Effect.flip))
			assert.ok(result instanceof InvalidInput)
		}
		assert.deepEqual(writes, [])
	})

	test('when an owned todo is missing, each operation returns a missing-record failure', async () => {
		const { todos } = fixture()
		for (const program of [
			todos.get('missing'),
			todos.update('missing', { completed: true }),
			todos.remove('missing'),
		]) {
			const error = await Effect.runPromise(program.pipe(Effect.flip))
			assert.ok(error instanceof MissingRecord)
		}
	})

	test('when todo storage fails, its cause is preserved', async () => {
		const failure = new StorageError({ cause: new Error('database unavailable') })
		const { todos } = fixture({ find: () => Effect.fail(failure) })
		const result = await Effect.runPromise(todos.get('one').pipe(Effect.flip))
		assert.equal(result, failure)
	})
})

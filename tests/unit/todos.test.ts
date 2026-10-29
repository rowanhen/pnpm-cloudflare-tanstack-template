import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Cause, Effect, Exit, Layer } from 'effect'
import type { Todo } from '@workspace/contracts'
import { TodoLive } from '../../apps/api/src/features/todos/live.ts'
import { InvalidTodo } from '../../apps/api/src/features/todos/domain.ts'
import {
	TodoNotFound,
	TodoRepository,
	TodoService,
} from '../../apps/api/src/features/todos/service.ts'
import { StorageError, storageEffect } from '../../apps/api/src/persistence.ts'
import { preserveFatal } from '../../apps/api/src/effect-errors.ts'

const todo: Todo = {
	id: 'one',
	title: 'Example',
	completed: false,
	created_at: '2026-10-29T10:00:00Z',
}
function fixture(overrides: Partial<typeof TodoRepository.Service> = {}) {
	const writes: unknown[] = []
	const repository: typeof TodoRepository.Service = {
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
	const layer = TodoLive.pipe(Layer.provide(Layer.succeed(TodoRepository, repository)))
	return { writes, layer }
}
const withTodos = <A, E>(program: (service: typeof TodoService.Service) => Effect.Effect<A, E>) =>
	Effect.flatMap(TodoService, program)

test('production todo workflow runs with an injected repository and preserves valid partial changes', async () => {
	const { writes, layer } = fixture()
	const result = await Effect.runPromise(
		withTodos((service) =>
			Effect.gen(function* () {
				const created = yield* service.create('  New task  ')
				const updated = yield* service.update('one', { completed: false })
				const renamed = yield* service.update('one', { title: '  Renamed  ', completed: true })
				return { created, updated, renamed, listed: yield* service.list }
			}),
		).pipe(Effect.provide(layer)),
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

test('internal callers cannot write invalid titles or empty/unknown changes', async () => {
	const { writes, layer } = fixture()
	const unexpected = { completed: true, user_id: 'another-user' }
	const programs = [
		withTodos((s) => s.create('   ')),
		withTodos((s) => s.create('x'.repeat(201))),
		withTodos((s) => s.update('one', {})),
		withTodos((s) => s.update('one', { title: '   ' })),
		withTodos((s) => s.update('one', unexpected)),
	]
	for (const program of programs) {
		const result = await Effect.runPromise(program.pipe(Effect.provide(layer), Effect.flip))
		assert.ok(result instanceof InvalidTodo)
	}
	assert.deepEqual(writes, [])
})

test('missing todos stay typed domain errors for all owned-record operations', async () => {
	const { layer } = fixture()
	for (const program of [
		withTodos((s) => s.get('missing')),
		withTodos((s) => s.update('missing', { completed: true })),
		withTodos((s) => s.remove('missing')),
	]) {
		const error = await Effect.runPromise(program.pipe(Effect.provide(layer), Effect.flip))
		assert.ok(error instanceof TodoNotFound)
	}
})

test('storage failures retain their cause and are never mistaken for a missing record', async () => {
	const failure = new StorageError({ cause: new Error('database unavailable') })
	const { layer } = fixture({ find: () => Effect.fail(failure) })
	const result = await Effect.runPromise(
		withTodos((s) => s.get('one')).pipe(Effect.provide(layer), Effect.flip),
	)
	assert.equal(result, failure)
})

test('typed recovery cannot turn a mixed fatal cause into a successful response', async () => {
	for (const reason of [Cause.makeDieReason(new Error('defect')), Cause.makeInterruptReason()]) {
		const cause = Cause.fromReasons([Cause.makeFailReason(new TodoNotFound()), reason])
		const result = await Effect.runPromiseExit(
			Effect.failCause(cause).pipe(
				preserveFatal,
				Effect.catchTag('TodoNotFound', () => Effect.succeed('must not recover')),
			),
		)
		assert.ok(Exit.isFailure(result))
		assert.ok(Cause.hasDies(result.cause) || Cause.hasInterrupts(result.cause))
	}
})

test('non-abortable storage settles before interrupted workflow cleanup', async () => {
	let start: (() => void) | undefined
	const started = new Promise<void>((resolve) => {
		start = resolve
	})
	let release: ((value: string) => void) | undefined
	const query = new Promise<string>((resolve) => {
		release = resolve
	})
	const controller = new AbortController()
	let cleaned = false
	const result = Effect.runPromiseExit(
		storageEffect(() => {
			assert.ok(start)
			start()
			return query
		}).pipe(
			Effect.ensuring(
				Effect.sync(() => {
					cleaned = true
				}),
			),
		),
		{ signal: controller.signal },
	)
	await started
	controller.abort()
	await Promise.resolve()
	assert.equal(cleaned, false)
	assert.ok(release)
	release('saved')
	const exit = await result
	assert.ok(Exit.isFailure(exit))
	assert.ok(Cause.hasInterrupts(exit.cause))
	assert.equal(cleaned, true)
})

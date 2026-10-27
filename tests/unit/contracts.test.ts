import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect, Schema } from 'effect'
import {
	createTodo,
	getTodo,
	deleteTodo,
	updateTodo,
} from '../../packages/contracts/src/generated/operations.ts'
import {
	contractError,
	contractResponse,
	decodeResponse,
	findOperation,
} from '../../packages/contracts/src/http.ts'
import { getTodo as getTodoHandler } from '../../apps/api/src/features/todos/get-todo.ts'
import { ApiRequest } from '../../apps/api/src/contract/context.ts'
import { productDatabase } from '../../packages/data/src/client.ts'
import {
	ApiError,
	ContractViolation,
	TransportError,
	contractFetch,
} from '../../apps/dashboard/src/lib/contract-fetch.ts'

const todo = {
	id: 'example',
	title: 'Example',
	completed: false,
	created_at: '2026-10-17T12:00:00Z',
}

test('validates every declared status/body pair, including 201, 204, and errors', async () => {
	assert.equal(contractResponse(createTodo, 201, { todo }).status, 201)
	assert.equal(await contractResponse(deleteTodo, 204, undefined).text(), '')
	const missing = contractError(getTodo, 404, 'Todo not found')
	assert.deepEqual(await missing.json(), { code: 'todo_not_found', error: 'Todo not found' })
	assert.throws(() => decodeResponse(getTodo, 404, { code: 'forbidden', error: 'No' }))
	assert.throws(() => decodeResponse(createTodo, 200, { todo }), /undeclared HTTP status/)
	assert.throws(() => decodeResponse(createTodo, 201, { todo: { ...todo, user_id: 'private' } }))
	assert.throws(() => decodeResponse(createTodo, 201, { todo: { ...todo, completed: 'false' } }))
	assert.throws(() => decodeResponse(deleteTodo, 204, { unexpected: true }))
})

test('enforces generated inputs, strict fields, and nonempty updates', () => {
	const decode = Schema.decodeUnknownSync(updateTodo.input, { onExcessProperty: 'error' })
	assert.throws(() => decode({ params: { id: 'example' }, body: {} }))
	assert.throws(() => decode({ params: { id: 'example' }, body: { user_id: 'other' } }))
	assert.deepEqual(decode({ params: { id: 'example' }, body: { completed: false } }).body, {
		completed: false,
	})
	assert.throws(() => Schema.decodeUnknownSync(createTodo.input)({ body: { title: '   ' } }))
	assert.equal(findOperation('PATCH', '/api/todos/example')?.operationId, 'updateTodo')
	assert.equal(findOperation('GET', '/api/todos/example/extra'), undefined)
})

test('a missing database row produces a typed Effect failure, not a rejected promise', async () => {
	const db = productDatabase({
		prepare: () => ({
			bind() {
				return this
			},
			raw: async () => [],
		}),
	} as unknown as Parameters<typeof productDatabase>[0])
	const response = await Effect.runPromise(
		getTodoHandler({ params: { id: 'missing' } }).pipe(
			Effect.provideService(ApiRequest, { db, userId: 'owner' }),
			Effect.match({ onSuccess: () => 'unexpected success', onFailure: (error) => error }),
		),
	)
	assert.deepEqual(response, {
		status: 404,
		body: { code: 'todo_not_found', error: 'Todo not found' },
	})
})

test('frontend transport validates successes/errors and distinguishes contract/network failures', async (t) => {
	t.mock.method(globalThis, 'fetch', async () => Response.json({ todo }, { status: 201 }))
	const result = await contractFetch<{ data: { todo: typeof todo }; status: 201 }>('/api/todos', {
		method: 'POST',
	})
	assert.equal(result.status, 201)
	assert.deepEqual(result.data.todo, todo)
	t.mock.method(globalThis, 'fetch', async () =>
		Response.json({ code: 'todo_not_found', error: 'Gone' }, { status: 404 }),
	)
	// observedFetch's browser telemetry reads the current origin on failed requests.
	Object.defineProperty(globalThis, 'window', {
		value: { location: { origin: 'http://localhost' } },
		configurable: true,
	})
	t.after(() => {
		Reflect.deleteProperty(globalThis, 'window')
	})
	await assert.rejects(
		contractFetch(
			'/api/todos/missing',
			{},
			{ errorResponses: [{ status: 404, contentType: 'application/json' }] },
		),
		(error) => {
			assert.ok(error instanceof ApiError)
			assert.equal(error.status, 404)
			assert.deepEqual(error.response, {
				data: { code: 'todo_not_found', error: 'Gone' },
				status: 404,
				headers: new Headers({ 'content-type': 'application/json' }),
			})
			return true
		},
	)
	t.mock.method(globalThis, 'fetch', async () =>
		Response.json({ code: 'forbidden', error: 'Wrong shape for 404' }, { status: 404 }),
	)
	await assert.rejects(contractFetch('/api/todos/missing'), ContractViolation)
	t.mock.method(globalThis, 'fetch', async () => {
		throw new Error('Network unavailable')
	})
	await assert.rejects(contractFetch('/api/todos'), TransportError)
})

import assert from 'node:assert/strict'
import { describe, test, onTestFinished, vi } from 'vitest'
import { ApiError, ContractViolation, TransportError, contractFetch } from '../contract-fetch.ts'
import { getTodoMock } from '../../generated/schemas.faker.ts'

describe('dashboard contract transport', () => {
	test('when frontend responses or network calls fail, transport reports the right failure', async () => {
		const todo = getTodoMock()
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
			Response.json({ todo }, { status: 201 }),
		)
		const result = await contractFetch<{ data: { todo: typeof todo }; status: 201 }>('/api/todos', {
			method: 'POST',
		})
		assert.equal(result.status, 201)
		assert.deepEqual(result.data.todo, todo)
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
			Response.json({ code: 'todo_not_found', error: 'Gone' }, { status: 404 }),
		)
		// observedFetch's browser telemetry reads the current origin on failed requests.
		Object.defineProperty(globalThis, 'window', {
			value: { location: { origin: 'http://localhost' } },
			configurable: true,
		})
		onTestFinished(() => {
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
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
			Response.json({ code: 'forbidden', error: 'Wrong shape for 404' }, { status: 404 }),
		)
		await assert.rejects(contractFetch('/api/todos/missing'), ContractViolation)
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
			throw new Error('Network unavailable')
		})
		await assert.rejects(contractFetch('/api/todos'), TransportError)
	})
})

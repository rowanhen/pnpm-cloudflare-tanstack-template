import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Schema } from 'effect'
import { createTodo, getTodo, deleteTodo, updateTodo } from '../generated/operations.ts'
import { contractError, contractResponse, decodeResponse, findOperation } from '../http.ts'

describe('HTTP contracts', () => {
	test('when a response uses a declared status, its body is validated', async () => {
		const todo = {
			id: 'example',
			title: 'Example',
			completed: false,
			created_at: '2026-10-17T12:00:00Z',
		}
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

	test('when inputs contain unknown fields or empty updates, generated schemas reject them', () => {
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

	test('when application inputs and responses change, generated schemas validate them', async () => {
		const { createKey, createSummary, uploadFile, getMe, getBilling, headFile } =
			await import('../generated/operations.ts')
		assert.throws(() =>
			Schema.decodeUnknownSync(createKey.input)({ body: { name: ' ', scope: 'todos:read' } }),
		)
		assert.throws(() =>
			Schema.decodeUnknownSync(createKey.input)({ body: { name: 'Key', scope: 'admin' } }),
		)
		assert.throws(() => Schema.decodeUnknownSync(createSummary.input)({ body: {}, headers: {} }))
		assert.throws(() =>
			Schema.decodeUnknownSync(createSummary.input)({
				body: {},
				headers: { 'idempotency-key': 'invalid' },
			}),
		)
		assert.throws(() =>
			Schema.decodeUnknownSync(uploadFile.input)({
				params: { key: 'a/b' },
				body: new File([], 'file'),
			}),
		)
		assert.throws(() =>
			decodeResponse(getMe, 200, {
				user: {
					id: 'id',
					name: 'Name',
					email: 'a@example.test',
					emailVerified: true,
					image: null,
					password: 'private',
				},
			}),
		)
		assert.throws(() =>
			decodeResponse(getBilling, 200, {
				balance: '10',
				summaryCost: 1,
				packCredits: 1000,
				activity: [],
			}),
		)
		assert.equal(await contractError(headFile, 404, 'Missing').text(), '')
	})
})

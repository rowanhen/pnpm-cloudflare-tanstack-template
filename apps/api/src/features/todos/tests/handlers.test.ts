import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Effect } from 'effect'
import { getTodo as getTodoHandler } from '../handlers.ts'
import { ApiRequest } from '../../../contract/context.ts'
import { MissingRecord } from '../../../errors.ts'
import { database } from '../../../../../../packages/data/src/client.ts'

describe('todo handlers', () => {
	test('when a database row is missing, the Effect fails with a typed error', async () => {
		const db = database({
			prepare: () => ({
				bind() {
					return this
				},
				raw: async () => [],
			}),
		} as unknown as Parameters<typeof database>[0])
		const response = await Effect.runPromise(
			getTodoHandler({ params: { id: 'missing' } }).pipe(
				Effect.provideService(ApiRequest, {
					db,
					userId: 'owner',
					user: {
						id: 'owner',
						name: 'Owner',
						email: 'owner@example.test',
						emailVerified: true,
						image: null,
					},
					request: new Request('http://localhost/api/todos/missing'),
					get env(): never {
						throw new Error('This query must only use DB')
					},
				}),
				Effect.match({ onSuccess: () => 'unexpected success', onFailure: (error) => error }),
			),
		)
		assert.ok(response instanceof MissingRecord)
		assert.equal(response.message, 'Todo not found')
	})
})

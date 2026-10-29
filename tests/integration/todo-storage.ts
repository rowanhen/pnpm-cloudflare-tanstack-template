import assert from 'node:assert/strict'
import type { LocalWorker } from '../support/local-worker.ts'

export async function testTodoStorage(worker: LocalWorker) {
	// Valid SQLite storage can still violate an application invariant.
	worker.query(
		"INSERT INTO todos(id,user_id,title) VALUES ('invalid-stored-todo','e2e-alice','   ')",
		'product',
	)
	try {
		for (const path of ['/api/todos/invalid-stored-todo', '/api/todos']) {
			const response = await fetch(`${worker.base}${path}`, {
				headers: { Cookie: worker.fixture.cookies[0] },
			})
			assert.equal(response.status, 500)
			const body: unknown = await response.json()
			assert.deepEqual(body, { code: 'internal_error', error: 'Internal server error' })
		}
		const otherUser = await fetch(`${worker.base}/api/todos`, {
			headers: { Cookie: worker.fixture.cookies[1] },
		})
		assert.equal(otherUser.status, 200)
		assert.deepEqual(await otherUser.json(), { todos: [] })
	} finally {
		worker.query("DELETE FROM todos WHERE id='invalid-stored-todo'", 'product')
	}
	console.log(
		'PASS todo storage: invalid persisted values produce sanitized errors without crossing ownership boundaries',
	)
}

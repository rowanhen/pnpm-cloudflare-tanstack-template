import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { LocalWorker } from '../support/local-worker.ts'

export async function testMeteredValidation(worker: LocalWorker) {
	const response = await fetch(worker.base + '/api/keys', {
		method: 'POST',
		headers: {
			Cookie: worker.fixture.cookies[1],
			Origin: 'http://localhost:3001',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ name: 'Validation test', scope: 'summary:read' }),
	})
	assert.equal(response.status, 201)
	const { key } = await response.json()
	const before = worker.query(
		"SELECT balance FROM credit_accounts WHERE user_id='e2e-bob'",
		'billing',
	)[0].balance
	const count = worker.query(
		"SELECT COUNT(*) AS count FROM paid_requests WHERE user_id='e2e-bob'",
		'billing',
	)[0].count
	// Simulate a malformed historical row; do not relax application constraints or migrations.
	worker.query(
		"PRAGMA ignore_check_constraints=ON; INSERT INTO todos(id,user_id,title,completed) VALUES ('invalid-summary','e2e-bob','Invalid old value',2); PRAGMA ignore_check_constraints=OFF;",
		'product',
	)
	try {
		const result = await fetch(worker.base + '/api/v1/summary', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${key.token}`,
				'Content-Type': 'application/json',
				'Idempotency-Key': randomUUID(),
			},
			body: JSON.stringify({ status: 'all' }),
		})
		assert.equal(result.status, 500)
		assert.deepEqual(await result.json(), {
			code: 'internal_error',
			error: 'Internal server error',
		})
		assert.equal(
			worker.query("SELECT balance FROM credit_accounts WHERE user_id='e2e-bob'", 'billing')[0]
				.balance,
			before,
		)
		assert.equal(
			worker.query(
				"SELECT COUNT(*) AS count FROM paid_requests WHERE user_id='e2e-bob'",
				'billing',
			)[0].count,
			count,
		)
	} finally {
		worker.query("DELETE FROM todos WHERE id='invalid-summary'", 'product')
		await fetch(`${worker.base}/api/keys/${key.id}`, {
			method: 'DELETE',
			headers: { Cookie: worker.fixture.cookies[1], Origin: 'http://localhost:3001' },
		})
	}
	console.log(
		'PASS metering validation: corrupt snapshots create neither a debit nor a saved receipt',
	)
}

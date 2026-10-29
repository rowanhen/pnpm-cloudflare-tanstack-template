import type { LocalWorker } from '../support/local-worker.ts'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

export async function testEmail(worker: LocalWorker) {
	const { base, fixture } = worker
	const query = (statement: string) => worker.query(statement, 'product')
	const call = (body: unknown, { user = 0, headers = {}, method = 'POST' } = {}) =>
		fetch(`${base}/api/email`, {
			method,
			headers: {
				Cookie: fixture.cookies[user],
				Origin: 'http://localhost:3001',
				'Content-Type': 'application/json',
				...headers,
			},
			body: method === 'POST' ? JSON.stringify(body) : undefined,
		})
	const id = randomUUID()
	assert.equal((await fetch(`${base}/api/email`)).status, 401)
	assert.equal(
		(await call({ requestId: id }, { headers: { Origin: 'https://evil.example' } })).status,
		403,
	)
	assert.equal((await call({ requestId: id, to: 'someone@example.test' })).status, 400)
	assert.equal(
		(await call({ requestId: id }, { headers: { 'x-test-email-disabled': 'true' } })).status,
		503,
	)
	worker.query("UPDATE users SET emailVerified=0 WHERE id='e2e-bob'", 'identity')
	try {
		assert.equal((await call({ requestId: id }, { user: 1 })).status, 403)
	} finally {
		worker.query("UPDATE users SET emailVerified=1 WHERE id='e2e-bob'", 'identity')
	}
	const attempts = await Promise.all([call({ requestId: id }), call({ requestId: id })])
	assert.ok(attempts.some((r) => r.status === 202))
	for (const response of attempts)
		assert.ok([202, 409].includes(response.status), await response.text())
	const replay = await call({ requestId: id })
	assert.equal(replay.status, 202, await replay.clone().text())
	const saved = (await replay.json()).email
	assert.equal(saved.status, 'accepted')
	assert.ok(saved.messageId)
	assert.equal((await call({ requestId: randomUUID() })).status, 429)
	const rows = query("SELECT * FROM email_deliveries WHERE user_id='e2e-alice'")
	assert.equal(rows.length, 1)
	assert.equal(rows[0].to_email, 'alice@example.test')
	assert.equal(rows[0].message_id, saved.messageId)
	const bob = await call(null, { user: 1, method: 'GET' })
	assert.deepEqual((await bob.json()).emails, [])
	const failureId = randomUUID()
	assert.equal(
		(await call({ requestId: failureId }, { user: 1, headers: { 'x-test-email-failure': 'true' } }))
			.status,
		502,
	)
	assert.equal((await call({ requestId: failureId }, { user: 1 })).status, 409)
	const failed = (await (await call(null, { user: 1, method: 'GET' })).json()).emails
	assert.equal(failed.length, 1)
	assert.equal(failed[0].status, 'failed')
	assert.deepEqual(Object.keys(failed[0]).sort(), ['created_at', 'id', 'status'])
	const waitlist = query(
		"SELECT status FROM email_deliveries WHERE dedupe_key IN (SELECT 'waitlist:' || id FROM waitlist WHERE email='alice@example.test')",
	)
	assert.equal(waitlist.length, 1)
	assert.equal(waitlist[0].status, 'accepted')
	const signup = await fetch(`${base}/api/waitlist`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-test-email-failure': 'true',
			'cf-connecting-ip': '192.0.2.120',
		},
		body: JSON.stringify({ email: 'email-failure@example.test', consent: true }),
	})
	assert.equal(signup.status, 202)
	assert.equal(
		query("SELECT status FROM email_deliveries WHERE to_email='email-failure@example.test'")[0]
			.status,
		'failed',
	)
	// A delivery-ledger failure is not an optional provider failure.
	query(
		"CREATE TRIGGER reject_confirmation BEFORE INSERT ON email_deliveries WHEN NEW.to_email='storage-failure@example.test' BEGIN SELECT RAISE(ABORT, 'private-storage-error'); END;",
	)
	try {
		const response = await fetch(`${base}/api/waitlist`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '192.0.2.121' },
			body: JSON.stringify({ email: 'storage-failure@example.test', consent: true }),
		})
		assert.equal(response.status, 500)
		assert.deepEqual(await response.json(), {
			code: 'internal_error',
			error: 'Internal server error',
		})
	} finally {
		query('DROP TRIGGER reject_confirmation')
	}
	console.log(
		'PASS email: native local binding, deduplication/replay, privacy, verified recipient, CSRF, rate limit, provider failure, signup survives mail failure (simulated delivery)',
	)
}

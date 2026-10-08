import type { Responses, KeyScope } from '../packages/contracts/src/index.ts'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

// Runs unchanged against workerd and the deployed Worker with a real D1 database.
export async function testMetering(
	base: string,
	cookies: string[],
	origin = 'http://localhost:3001',
) {
	const session = (path: string, method = 'GET', body?: unknown, cookie = cookies[0]) =>
		fetch(base + path, {
			method,
			headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
		})
	const billing = async (cookie = cookies[0]): Promise<Responses['billing']> => {
		const result = await session('/api/billing', 'GET', undefined, cookie)
		assert.equal(result.status, 200, await result.clone().text())
		return result.json()
	}
	const createKey = async (
		scope: KeyScope,
		cookie = cookies[0],
	): Promise<Responses['createKey']['key']> => {
		const response = await session('/api/keys', 'POST', { name: 'Metering test', scope }, cookie)
		assert.equal(response.status, 201, await response.clone().text())
		return (await response.json()).key
	}
	const paid = await createKey('summary:read')
	const other = await createKey('summary:read', cookies[1])
	const sibling = await createKey('summary:read')
	const free = await createKey('todos:read')
	const call = (key = paid, id: string = randomUUID(), body: unknown = {}) =>
		fetch(base + '/api/v1/summary', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${key.token}`,
				'Content-Type': 'application/json',
				'Idempotency-Key': id,
			},
			body: JSON.stringify(body),
		})
	assert.equal((await billing()).balance, 3)
	assert.equal((await fetch(base + '/api/billing')).status, 401)
	assert.equal(
		(await fetch(base + '/api/billing', { headers: { Authorization: `Bearer ${paid.token}` } }))
			.status,
		401,
	)
	assert.equal((await call(free)).status, 403)
	assert.equal(
		(await fetch(base + '/api/v1/todos', { headers: { Authorization: `Bearer ${paid.token}` } }))
			.status,
		403,
	)
	assert.equal((await call(paid, 'bad')).status, 400)
	assert.equal((await call(paid, randomUUID(), { status: 'invalid' })).status, 400)
	assert.equal((await call(paid, randomUUID(), { cost: 0 })).status, 400)
	assert.equal((await session('/api/v1/summary', 'POST', {})).status, 401)
	// This trigger exists only in the isolated fixture database. A debit failure
	// must roll back both the result and balance; retrying must fail again, not replay.
	for (let i = 0; i < 2; i++)
		assert.equal((await call(paid, '00000000-0000-4000-8000-000000000bad')).status, 500)
	assert.equal((await billing()).balance, 3)
	assert.equal((await billing()).activity.length, 0)
	const todo = await (await session('/api/todos', 'POST', { title: 'Billable summary' })).json()
	const id = randomUUID()
	const duplicate = await Promise.all(
		Array.from({ length: 6 }, (_, index) => call(index % 2 ? paid : sibling, id)),
	)
	for (const response of duplicate)
		assert.equal(response.status, 200, await response.clone().text())
	assert.equal(
		duplicate.reduce((sum, response) => sum + Number(response.headers.get('X-Credits-Charged')), 0),
		1,
	)
	assert.equal(new Set(duplicate.map((response) => response.headers.get('X-Request-Id'))).size, 1)
	const bodies = await Promise.all(duplicate.map((response) => response.text()))
	assert.equal(new Set(bodies).size, 1)
	assert.deepEqual(JSON.parse(bodies[0]), {
		summary: { total: 1, completed: 0, open: 1 },
		status: 'all',
	})
	assert.equal((await billing()).balance, 2)
	assert.equal((await call(paid, id, { status: 'completed' })).status, 409)
	// Same idempotency key belongs to a different user: separate result and debit.
	const isolated = await call(other, id)
	assert.equal(isolated.status, 200)
	assert.deepEqual((await isolated.json()).summary, { total: 0, completed: 0, open: 0 })
	assert.equal((await billing(cookies[1])).balance, 2)
	await session(`/api/todos/${todo.todo.id}`, 'PATCH', { completed: true })
	const lastCredits = await Promise.all(
		Array.from({ length: 6 }, (_, index) => call(index % 2 ? paid : sibling)),
	)
	assert.equal(lastCredits.filter((response) => response.status === 200).length, 2)
	assert.equal(lastCredits.filter((response) => response.status === 402).length, 4)
	assert.equal((await billing()).balance, 0)
	const depletedReplay = await call(paid, id.toUpperCase())
	assert.equal(depletedReplay.status, 200)
	assert.equal(await depletedReplay.text(), bodies[0])
	assert.equal(depletedReplay.headers.get('X-Credits-Charged'), '0')
	assert.equal(depletedReplay.headers.get('Idempotency-Replayed'), 'true')
	assert.equal(depletedReplay.headers.get('X-Credits-Balance'), '0')
	assert.equal((await billing()).activity.length, 3)
	assert.equal(
		(await billing()).activity.reduce((sum, entry) => sum + entry.credits, 0),
		-3,
	)
	const insufficient = await call(paid)
	assert.equal(insufficient.status, 402)
	assert.equal(insufficient.headers.get('X-Credits-Required'), '1')
	// Revocation also blocks replay. Deletion must preserve billed history.
	for (const [key, cookie] of [
		[paid, cookies[0]],
		[free, cookies[0]],
		[sibling, cookies[0]],
		[other, cookies[1]],
	] as const)
		assert.equal((await session(`/api/keys/${key.id}`, 'DELETE', undefined, cookie)).status, 204)
	assert.equal((await call(paid, id)).status, 401)
	assert.equal((await billing()).activity.length, 3)
	await session(`/api/todos/${todo.todo.id}`, 'DELETE')
	console.log(
		'PASS metering: explicit scope, private results, atomic debit/rollback, concurrent retries, input conflicts, last-credit race, 402, revoked replay, retained history (D1)',
	)
}

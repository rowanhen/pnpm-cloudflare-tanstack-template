import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'

export async function testCheckout(worker) {
	const headers = {
		Cookie: worker.fixture.cookies[0],
		Origin: 'http://localhost:3001',
		'Content-Type': 'application/json',
	}
	const call = (path, init = {}) =>
		fetch(worker.base + path, { ...init, headers: { ...headers, ...init.headers } })
	const create = (value) =>
		call('/api/checkout/sessions', { method: 'POST', body: JSON.stringify(value) })
	const patchProvider = (session, data) =>
		fetch(`${worker.stripeUrl}/__test/${session}`, { method: 'POST', body: JSON.stringify(data) })
	const webhook = (
		session,
		eventId = `evt_${randomUUID()}`,
		{ timestamp = Math.floor(Date.now() / 1000), signature = true } = {},
	) => {
		const payload = JSON.stringify({
			id: eventId,
			type: 'checkout.session.completed',
			livemode: false,
			data: { object: { id: session } },
		})
		const digest = createHmac('sha256', 'whsec_fixture')
			.update(`${timestamp}.${payload}`)
			.digest('hex')
		return fetch(worker.base + '/api/stripe/webhook', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Stripe-Signature': `t=${timestamp},v1=${signature ? digest : 'forged'}`,
			},
			body: payload,
		})
	}
	assert.equal((await fetch(worker.base + '/api/checkout/config')).status, 401)
	assert.equal(
		(
			await fetch(worker.base + '/api/checkout/sessions', {
				method: 'POST',
				headers: { Cookie: worker.fixture.cookies[0] },
			})
		).status,
		403,
	)
	const config = await call('/api/checkout/config')
	assert.equal(config.status, 200, await config.clone().text())
	assert.deepEqual((await config.json()).offer, {
		name: 'Starter pass',
		description: null,
		amount: 1200,
		currency: 'gbp',
	})
	assert.equal((await create({ requestId: randomUUID(), amount: 1 })).status, 400)
	assert.equal((await create({ requestId: 'bad' })).status, 400)
	const requestId = randomUUID()
	const concurrent = await Promise.all([create({ requestId }), create({ requestId })])
	for (const result of concurrent) assert.equal(result.status, 201, await result.clone().text())
	const [first, second] = await Promise.all(concurrent.map((response) => response.json()))
	assert.equal(first.sessionId, second.sessionId)
	assert.ok(first.clientSecret)
	const sessionPath = `/api/checkout/sessions/${first.sessionId}`
	assert.equal(
		(await call(sessionPath, { headers: { Cookie: worker.fixture.cookies[1] } })).status,
		404,
	)
	assert.equal((await (await call(sessionPath)).json()).order.status, 'pending')
	assert.equal((await webhook(first.sessionId, undefined, { signature: false })).status, 400)
	assert.equal(
		(await webhook(first.sessionId, undefined, { timestamp: Math.floor(Date.now() / 1000) - 600 }))
			.status,
		400,
	)
	// A signed event is still not proof of payment. The server fetches canonical state.
	assert.equal((await webhook(first.sessionId)).status, 200)
	assert.equal((await (await call(sessionPath)).json()).order.status, 'pending')
	await patchProvider(first.sessionId, {
		status: 'complete',
		payment_status: 'paid',
		amount_total: 1,
	})
	assert.equal((await webhook(first.sessionId)).status, 400)
	await patchProvider(first.sessionId, { amount_total: 1200 })
	const eventId = `evt_${randomUUID()}`
	const delivered = await Promise.all([
		webhook(first.sessionId, eventId),
		webhook(first.sessionId, eventId),
	])
	for (const result of delivered) assert.equal(result.status, 200, await result.clone().text())
	const paid = (await (await call(sessionPath)).json()).order
	assert.equal(paid.status, 'paid')
	assert.equal(paid.amount, 1200)
	// Reordered events cannot undo a fulfilled order.
	await patchProvider(first.sessionId, { status: 'open', payment_status: 'unpaid' })
	assert.equal((await webhook(first.sessionId)).status, 200)
	assert.equal((await (await call(sessionPath)).json()).order.status, 'paid')
	const expired = await (await create({ requestId: randomUUID() })).json()
	await patchProvider(expired.sessionId, { status: 'expired' })
	assert.equal(
		(await (await call(`/api/checkout/sessions/${expired.sessionId}`)).json()).order.status,
		'expired',
	)
	const limits = await Promise.all(
		Array.from({ length: 12 }, () => create({ requestId: randomUUID() })),
	)
	assert.ok(limits.some((response) => response.status === 429))
	console.log(
		'PASS checkout: server-selected price, auth/CSRF, idempotent creation, ownership, signed/replayed/forged webhooks, amount checks, verified fulfilment, expiry, rate limit (Stripe API fixture)',
	)
}

import assert from 'node:assert/strict'
import { randomUUID, createHmac } from 'node:crypto'
import type { LocalWorker } from '../support/local-worker.ts'
export async function testStorefront(worker: LocalWorker) {
	const call = (path: string, body: unknown, extra: Record<string, string> = {}) =>
		fetch(worker.base + path, {
			method: 'POST',
			headers: { Origin: 'http://localhost:3001', 'Content-Type': 'application/json', ...extra },
			body: JSON.stringify(body),
		})
	const catalogue = await fetch(worker.base + '/api/storefront')
	assert.equal(catalogue.status, 200)
	assert.equal((await catalogue.json()).products.length, 2)
	const disabled = await fetch(worker.base + '/api/storefront', {
		headers: { 'x-test-storefront-disabled': 'true' },
	})
	assert.deepEqual(await disabled.json(), { enabled: false, products: [] })
	assert.equal((await fetch(worker.base + '/api/todos')).status, 401)
	const token = randomUUID(),
		requestId = randomUUID()
	const input = { product: 'purchase', token, requestId }
	assert.equal(
		(
			await fetch(worker.base + '/api/storefront/checkouts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input),
			})
		).status,
		403,
	)
	assert.equal((await call('/api/storefront/checkouts', { ...input, amount: 1 })).status, 400)
	assert.equal(
		(await call('/api/storefront/checkouts', { ...input, product: 'other' })).status,
		400,
	)
	const first = await call('/api/storefront/checkouts', input)
	assert.equal(first.status, 200, await first.clone().text())
	const checkout = await first.json()
	const repeat = await call('/api/storefront/checkouts', input)
	assert.deepEqual(await repeat.json(), checkout)
	assert.ok(checkout.url.startsWith('https://checkout.stripe.com/'))
	const subscription = await call('/api/storefront/checkouts', {
		product: 'subscription',
		token,
		requestId: randomUUID(),
	})
	assert.equal(subscription.status, 200, await subscription.clone().text())
	const monthly = await subscription.json()
	const status = (sessionId: string, proof = token) =>
		call('/api/storefront/status', { sessionId, token: proof })
	assert.equal((await status(checkout.sessionId, randomUUID())).status, 404)
	assert.equal((await status('cs_live_example')).status, 400)
	assert.deepEqual(await (await status(checkout.sessionId)).json(), {
		status: 'open',
		mode: 'payment',
		amount: 1200,
		currency: 'gbp',
	})
	assert.equal((await (await status(monthly.sessionId)).json()).mode, 'subscription')
	const patch = (id: string, value: unknown) =>
		fetch(`${worker.stripeUrl}/__test/${id}`, { method: 'POST', body: JSON.stringify(value) })
	for (const id of [checkout.sessionId, monthly.sessionId]) {
		await patch(id, { status: 'complete', payment_status: 'paid' })
		assert.equal((await (await status(id)).json()).status, 'paid')
	}
	await patch(checkout.sessionId, { livemode: true })
	assert.equal((await status(checkout.sessionId)).status, 404)
	await patch(checkout.sessionId, { livemode: false })
	// Guest purchases deliberately never fulfil a workspace credit order.
	const before = worker.query('SELECT SUM(balance) AS balance FROM credit_accounts')[0].balance
	const payload = JSON.stringify({
		id: 'evt_guest_' + randomUUID(),
		type: 'checkout.session.completed',
		livemode: false,
		data: { object: { id: checkout.sessionId } },
	})
	const timestamp = Math.floor(Date.now() / 1000)
	const digest = createHmac('sha256', 'whsec_fixture')
		.update(`${timestamp}.${payload}`)
		.digest('hex')
	const event = await fetch(worker.base + '/api/stripe/webhook', {
		method: 'POST',
		headers: { 'Stripe-Signature': `t=${timestamp},v1=${digest}` },
		body: payload,
	})
	assert.equal(event.status, 200)
	assert.equal(
		worker.query('SELECT SUM(balance) AS balance FROM credit_accounts')[0].balance,
		before,
	)
	for (let i = 0; i < 10; i++)
		assert.equal(
			(await call('/api/storefront/checkouts', input, { 'cf-connecting-ip': '198.51.100.10' }))
				.status,
			200,
		)
	assert.equal(
		(await call('/api/storefront/checkouts', input, { 'cf-connecting-ip': '198.51.100.10' }))
			.status,
		429,
	)
	console.log(
		'PASS public checkout: no account, trusted origin, server prices, retry idempotency, subscription, buyer proof, test-only status, no credit grants, rate limits',
	)
}

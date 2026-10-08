// A wire-level Stripe fixture for isolated tests. It is never imported by application code.
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'

export async function stripeFixture() {
	const sessions = new Map()
	const idempotency = new Map()
	const server = createServer(async (request, response) => {
		const url = new URL(request.url, 'http://localhost')
		const send = (data, status = 200) => {
			response.writeHead(status, {
				'Content-Type': 'application/json',
				'Request-Id': 'req_test_fixture',
			})
			response.end(JSON.stringify(data))
		}
		if (url.pathname.startsWith('/__test/')) {
			const session = sessions.get(url.pathname.split('/')[2])
			if (!session) return send({ error: 'Unknown fixture session' }, 404)
			if (request.method === 'POST') {
				const chunks = []
				for await (const chunk of request) chunks.push(chunk)
				Object.assign(session, JSON.parse(Buffer.concat(chunks).toString()))
			}
			return send(session)
		}
		if (request.headers.authorization !== 'Bearer sk_test_fixture')
			return send(
				{ error: { message: 'Unexpected fixture credential', type: 'authentication_error' } },
				401,
			)
		if (url.pathname === '/v1/prices/price_fixture')
			return send({
				id: 'price_fixture',
				object: 'price',
				livemode: false,
				active: true,
				type: 'one_time',
				unit_amount: 1200,
				currency: 'gbp',
				product: {
					id: 'prod_fixture',
					object: 'product',
					active: true,
					name: 'Starter pass',
					description: null,
				},
			})
		if (url.pathname === '/v1/checkout/sessions' && request.method === 'POST') {
			const chunks = []
			for await (const chunk of request) chunks.push(chunk)
			const fields = new URLSearchParams(Buffer.concat(chunks).toString())
			if (
				fields.get('ui_mode') !== 'elements' ||
				fields.get('mode') !== 'payment' ||
				fields.get('line_items[0][price]') !== 'price_fixture' ||
				fields.get('line_items[0][quantity]') !== '1' ||
				fields.get('allowed_payment_method_types[0]') !== 'card' ||
				fields.get('adaptive_pricing[enabled]') !== 'false'
			)
				return send(
					{ error: { type: 'invalid_request_error', message: 'Unexpected checkout contract' } },
					400,
				)
			const key = request.headers['idempotency-key']
			if (idempotency.has(key)) return send(sessions.get(idempotency.get(key)))
			const id = `cs_test_${randomBytes(16).toString('hex')}`
			const session = {
				id,
				object: 'checkout.session',
				livemode: false,
				mode: 'payment',
				status: 'open',
				payment_status: 'unpaid',
				amount_total: 1200,
				currency: 'gbp',
				client_secret: `${id}_secret_fixture`,
				client_reference_id: fields.get('client_reference_id'),
				metadata: { order_id: fields.get('metadata[order_id]') },
				return_url: fields.get('return_url'),
			}
			sessions.set(id, session)
			idempotency.set(key, id)
			return send(session)
		}
		const session = sessions.get(url.pathname.split('/').at(-1))
		if (session && request.method === 'GET') return send(session)
		send({ error: { type: 'invalid_request_error', message: 'Fixture resource not found' } }, 404)
	})
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
	return {
		url: `http://127.0.0.1:${server.address().port}`,
		stop: () =>
			new Promise((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			),
	}
}

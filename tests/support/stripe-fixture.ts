import { z } from 'zod'
import { serverPort } from '../../scripts/tooling.ts'
// A wire-level Stripe fixture for isolated tests. It is never imported by application code.
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'

const sessionSchema = z.object({
	id: z.string(),
	object: z.literal('checkout.session'),
	livemode: z.boolean(),
	mode: z.string(),
	status: z.string(),
	payment_status: z.string(),
	amount_total: z.number().nullable(),
	currency: z.string().nullable(),
	client_secret: z.string().nullable(),
	url: z.string().nullable(),
	success_url: z.string().nullable(),
	client_reference_id: z.string().nullable(),
	metadata: z.record(z.string(), z.string().nullable()),
	return_url: z.string().nullable(),
})
export async function stripeFixture() {
	const sessions = new Map<string, z.infer<typeof sessionSchema>>()
	const idempotency = new Map<string, string>()
	const server = createServer(async (request, response) => {
		const url = new URL(request.url ?? '/', 'http://localhost')
		const send = (data: unknown, status = 200) => {
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
				Object.assign(
					session,
					sessionSchema.partial().parse(JSON.parse(Buffer.concat(chunks).toString())),
				)
			}
			return send(session)
		}
		if (request.headers.authorization !== 'Bearer sk_test_fixture')
			return send(
				{ error: { message: 'Unexpected fixture credential', type: 'authentication_error' } },
				401,
			)
		if (
			[
				'/v1/prices/price_fixture',
				'/v1/prices/price_demo_fixture',
				'/v1/prices/price_subscription_fixture',
			].includes(url.pathname)
		)
			return send({
				id: url.pathname.split('/').at(-1),
				object: 'price',
				livemode: false,
				active: true,
				type: url.pathname.endsWith('price_subscription_fixture') ? 'recurring' : 'one_time',
				recurring: url.pathname.endsWith('price_subscription_fixture')
					? { interval: 'month' }
					: null,
				unit_amount: 1200,
				currency: 'gbp',
				product: {
					id: 'prod_fixture',
					object: 'product',
					active: true,
					name: url.pathname.endsWith('price_fixture')
						? 'API credits'
						: url.pathname.endsWith('price_demo_fixture')
							? 'Example product'
							: 'Example subscription',
					description: null,
				},
			})
		if (url.pathname === '/v1/checkout/sessions' && request.method === 'POST') {
			const chunks = []
			for await (const chunk of request) chunks.push(chunk)
			const fields = new URLSearchParams(Buffer.concat(chunks).toString())
			const guest = fields.get('metadata[example]') === 'storefront'
			const subscription = fields.get('mode') === 'subscription'
			const expectedPrice = guest
				? subscription
					? 'price_subscription_fixture'
					: 'price_demo_fixture'
				: 'price_fixture'
			if (
				fields.get('ui_mode') !== 'elements' ||
				(guest &&
					!fields
						.get('return_url')
						?.endsWith('/checkout/complete?session_id={CHECKOUT_SESSION_ID}')) ||
				fields.has('success_url') ||
				fields.has('cancel_url') ||
				(!subscription && fields.get('mode') !== 'payment') ||
				fields.get('line_items[0][price]') !== expectedPrice ||
				fields.get('line_items[0][quantity]') !== '1' ||
				fields.get('allowed_payment_method_types[0]') !== 'card' ||
				fields.get('adaptive_pricing[enabled]') !== 'false'
			)
				return send(
					{ error: { type: 'invalid_request_error', message: 'Unexpected checkout contract' } },
					400,
				)
			const key = request.headers['idempotency-key']
			if (typeof key !== 'string') return send({ error: 'Expected an idempotency key' }, 400)
			const previousId = idempotency.get(key)
			if (previousId) return send(sessions.get(previousId))
			const id = `cs_test_${randomBytes(16).toString('hex')}`
			const session: z.infer<typeof sessionSchema> = {
				id,
				object: 'checkout.session',
				livemode: false,
				mode: subscription ? 'subscription' : 'payment',
				status: 'open',
				payment_status: 'unpaid',
				amount_total: 1200,
				currency: 'gbp',
				client_secret: `${id}_secret_fixture`,
				url: null,
				success_url: fields.get('success_url'),
				client_reference_id: fields.get('client_reference_id'),
				metadata: Object.fromEntries(
					[...fields]
						.filter(([fieldName]) => fieldName.startsWith('metadata['))
						.map(([fieldName, value]) => [fieldName.slice(9, -1), value]),
				),
				return_url: fields.get('return_url'),
			}
			sessions.set(id, session)
			idempotency.set(key, id)
			return send(session)
		}
		const session = sessions.get(url.pathname.split('/').at(-1) ?? '')
		if (session && request.method === 'GET') return send(session)
		send({ error: { type: 'invalid_request_error', message: 'Fixture resource not found' } }, 404)
	})
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	return {
		url: `http://127.0.0.1:${serverPort(server)}`,
		stop: () =>
			new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			),
	}
}

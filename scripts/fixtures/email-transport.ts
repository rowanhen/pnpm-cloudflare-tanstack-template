// Loaded only by the setup tests; no real provider requests or DNS changes.
import { z } from 'zod'
const mode = z.enum(['new', 'existing', 'wrong-zone', 'denied']).parse(process.env.TEST_EMAIL_MODE)
globalThis.fetch = async (input, init = {}) => {
	const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
	if (
		url.hostname !== 'api.cloudflare.com' ||
		new Headers(init.headers).get('Authorization') !== 'Bearer email-fixture-token'
	)
		throw new Error('Unexpected provider request')
	const ok = (value: unknown) => Response.json({ success: true, result: value })
	if (url.pathname.endsWith(`/zones/${'a'.repeat(32)}`))
		return ok({ name: 'example.test', account: { id: 'b'.repeat(32) } })
	if (!url.pathname.endsWith('/email/sending/subdomains')) throw new Error('Unexpected path')
	if (mode === 'denied')
		return Response.json(
			{ success: false, errors: [{ code: 10000, message: 'Authentication error' }] },
			{ status: 403 },
		)
	if ((init.method ?? 'GET') === 'GET')
		return ok(
			mode === 'existing'
				? [{ name: 'mail.example.test', enabled: true, dkim_selector: 'fixture' }]
				: [],
		)
	if (
		mode !== 'new' ||
		typeof init.body !== 'string' ||
		z.object({ name: z.string() }).parse(JSON.parse(init.body)).name !== 'mail.example.test'
	)
		throw new Error('Unexpected domain mutation')
	return ok({
		name: 'mail.example.test',
		enabled: true,
		dkim_selector: 'fixture',
		return_path_domain: 'cf-bounce.mail.example.test',
	})
}

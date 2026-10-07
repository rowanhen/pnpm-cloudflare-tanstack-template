import type { Env } from './env'
import { HttpError } from './http'

export async function trustedProxyRequest(request: Request, env: Env) {
	const ip = request.headers.get('x-starter-ip')
	if (!ip) return request
	const timestamp = request.headers.get('x-starter-time') ?? ''
	const signature = request.headers.get('x-starter-signature') ?? ''
	if (
		!env.API_PROXY_SECRET ||
		!/^[a-f0-9]{64}$/.test(signature) ||
		!/^\d+$/.test(timestamp) ||
		Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 ||
		ip.length > 64
	) {
		throw new HttpError(403, 'Invalid proxy signature')
	}
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(env.API_PROXY_SECRET),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['verify'],
	)
	const valid = await crypto.subtle.verify(
		'HMAC',
		key,
		Uint8Array.from(signature.match(/../g) ?? [], (byte) => Number.parseInt(byte, 16)),
		new TextEncoder().encode(`${timestamp}\n${ip}`),
	)
	if (!valid) throw new HttpError(403, 'Invalid proxy signature')
	const forwarded = new Request(request)
	forwarded.headers.set('cf-connecting-ip', ip)
	return forwarded
}

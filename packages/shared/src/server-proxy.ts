import { signProxyIp } from './proxy-signature'

type RuntimeRequest = Request & {
	runtime?: { cloudflare?: { env?: { API_PROXY_SECRET?: string } } }
}

export async function backendHeaders(request: Request, base: string) {
	const headers = new Headers(request.headers)
	for (const header of [
		'host',
		'content-length',
		'x-starter-ip',
		'x-starter-time',
		'x-starter-signature',
	])
		headers.delete(header)
	// Nitro exposes runtime bindings on the request, never in the public Vite bundle.
	const secret = (request as RuntimeRequest).runtime?.cloudflare?.env?.API_PROXY_SECRET
	if (!secret && new URL(base).protocol === 'https:')
		throw new Error('Set API_PROXY_SECRET on this Pages project and the API Worker')
	if (secret) {
		const ip = request.headers.get('cf-connecting-ip') ?? '127.0.0.1'
		const timestamp = String(Math.floor(Date.now() / 1000))
		headers.set('x-starter-ip', ip)
		headers.set('x-starter-time', timestamp)
		headers.set('x-starter-signature', await signProxyIp(secret, ip, timestamp))
	}
	return headers
}

export async function proxyApi(request: Request, base: string) {
	const url = new URL(request.url)
	const init: RequestInit & { duplex: 'half' } = {
		duplex: 'half', // Required by Node's fetch for streamed request bodies during Vite development.
		method: request.method,
		headers: await backendHeaders(request, base),
		body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
		// Auth is forwarded explicitly in headers. Disable Node's automatic 401
		// credential retry, which cannot replay this streamed body (undici #4940).
		credentials: 'omit',
		redirect: 'manual',
		signal: AbortSignal.timeout(15000),
	}
	const response = await fetch(`${base}${url.pathname}${url.search}`, init)
	const result = new Response(response.body, response)
	// fetch decodes upstream compression; stale encoding/length headers break Node/Vite responses.
	if (result.headers.has('Content-Encoding')) {
		result.headers.delete('Content-Encoding')
		result.headers.delete('Content-Length')
	}
	result.headers.set('Cache-Control', 'no-store')
	return result
}

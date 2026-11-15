type ApiBinding = { fetch(request: Request): Promise<Response> }
type RuntimeRequest = Request & {
	runtime?: { cloudflare?: { env?: { API?: ApiBinding; API_PROXY_SECRET?: string } } }
}

export type ApiTarget = { dev: boolean; localUrl: string }

// Only trusted app servers can forward a client IP across Cloudflare zones.
async function signProxyIp(secret: string, ip: string, timestamp: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	)
	const signature = await crypto.subtle.sign(
		'HMAC',
		key,
		new TextEncoder().encode(`${timestamp}\n${ip}`),
	)
	return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function backendHeaders(request: Request, requireSignature: boolean) {
	const headers = new Headers(request.headers)
	for (const header of [
		'host',
		'content-length',
		'x-starter-ip',
		'x-starter-time',
		'x-starter-signature',
	])
		headers.delete(header)
	const secret = (request as RuntimeRequest).runtime?.cloudflare?.env?.API_PROXY_SECRET
	if (requireSignature && !secret)
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

export async function fetchApi(
	request: Request,
	path: string,
	init: RequestInit,
	target: ApiTarget,
) {
	const binding = (request as RuntimeRequest).runtime?.cloudflare?.env?.API
	if (!target.dev && !binding) throw new Error('Set the API service binding on this Pages project')
	const url = binding ? new URL(path, request.url) : new URL(path, target.localUrl)
	const outbound = new Request(url, {
		...init,
		headers: await backendHeaders(request, !target.dev),
		redirect: 'manual',
		signal: AbortSignal.timeout(15000),
		duplex: 'half', // Node needs this for streamed request bodies in Vite development.
	} as RequestInit & { duplex: 'half' })
	return binding ? binding.fetch(outbound) : fetch(outbound)
}

export async function proxyApi(request: Request, target: ApiTarget) {
	const url = new URL(request.url)
	const response = await fetchApi(
		request,
		`${url.pathname}${url.search}`,
		{
			method: request.method,
			body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
			credentials: 'omit',
		},
		target,
	)
	const result = new Response(response.body, response)
	// Node fetch decodes upstream compression; its old encoding headers would break Vite responses.
	if (result.headers.has('Content-Encoding')) {
		result.headers.delete('Content-Encoding')
		result.headers.delete('Content-Length')
	}
	result.headers.set('Cache-Control', 'no-store')
	return result
}

export class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
		public headers: Record<string, string> = {},
	) {
		super(message)
	}
}
export const json = (value: unknown, status = 200) => Response.json(value, { status })
export function methodNotAllowed(allow: string) {
	return new Response(JSON.stringify({ error: 'Method not allowed' }), {
		status: 405,
		headers: { 'Content-Type': 'application/json', Allow: allow },
	})
}
export async function readBody(request: Request, maxBytes: number) {
	const reader = request.body?.getReader()
	if (!reader) return new Uint8Array()
	const chunks: Uint8Array[] = []
	let size = 0
	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			size += value.byteLength
			if (size > maxBytes) {
				await reader.cancel()
				throw new HttpError(413, `Body exceeds ${maxBytes} bytes`)
			}
			chunks.push(value)
		}
	} finally {
		reader.releaseLock()
	}
	const bytes = new Uint8Array(size)
	let offset = 0
	for (const chunk of chunks) {
		bytes.set(chunk, offset)
		offset += chunk.length
	}
	return bytes
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
	if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
		throw new HttpError(415, 'Use Content-Type: application/json')
	const bytes = await readBody(request, 16 * 1024)
	let value: unknown
	try {
		value = JSON.parse(new TextDecoder().decode(bytes))
	} catch {
		throw new HttpError(400, 'Invalid JSON')
	}
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new HttpError(400, 'Expected a JSON object')
	return value as Record<string, unknown>
}
export function textField(value: unknown, name: string, max = 200) {
	if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
		throw new HttpError(400, `${name} must contain 1–${max} characters`)
	return value.trim()
}
export async function sha256(value: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

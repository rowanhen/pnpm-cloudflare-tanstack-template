export interface Env {
	DB: D1Database
	FILES: R2Bucket
	ALLOWED_ORIGINS: string
	REQUIRE_AUTH: string
	API_TOKEN?: string
}

type TodoRow = { id: string; title: string; completed: number; created_at: string }
const todo = (row: TodoRow) => ({ ...row, completed: row.completed === 1 })
const json = (value: unknown, status = 200) => Response.json(value, { status })
class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message)
	}
}

async function readBody(request: Request, maxBytes: number) {
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

async function readJson(request: Request): Promise<Record<string, unknown>> {
	if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
		throw new HttpError(415, 'Use Content-Type: application/json')
	}
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
function title(value: unknown) {
	if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) {
		throw new HttpError(400, 'title must contain 1–200 characters')
	}
	return value.trim()
}
function methodNotAllowed(allow: string) {
	return new Response(JSON.stringify({ error: 'Method not allowed' }), {
		status: 405,
		headers: { 'Content-Type': 'application/json', Allow: allow },
	})
}

async function route(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url)
	const path = url.pathname
	const method = request.method
	if (path === '/api/health') return method === 'GET' ? json({ ok: true }) : methodNotAllowed('GET')
	if (!path.startsWith('/api/')) throw new HttpError(404, 'Not found')
	if (env.REQUIRE_AUTH !== 'false') {
		if (!env.API_TOKEN) throw new HttpError(503, 'Configure the API_TOKEN Worker secret')
		// Compare fixed-length digests so token contents do not affect comparison time.
		const expected = new Uint8Array(
			await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`Bearer ${env.API_TOKEN}`)),
		)
		const supplied = new Uint8Array(
			await crypto.subtle.digest(
				'SHA-256',
				new TextEncoder().encode(request.headers.get('authorization') ?? ''),
			),
		)
		let difference = 0
		for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ supplied[i]
		if (difference) throw new HttpError(401, 'Invalid or missing bearer token')
	}
	if (path === '/api/todos') {
		if (method === 'GET') {
			const { results } = await env.DB.prepare(
				'SELECT * FROM todos ORDER BY created_at DESC, id DESC LIMIT 100',
			).all<TodoRow>()
			return json({ todos: results.map(todo) })
		}
		if (method === 'POST') {
			const body = await readJson(request)
			const row = await env.DB.prepare('INSERT INTO todos (id, title) VALUES (?, ?) RETURNING *')
				.bind(crypto.randomUUID(), title(body.title))
				.first<TodoRow>()
			return json({ todo: todo(row as TodoRow) }, 201)
		}
		return methodNotAllowed('GET, POST')
	}
	const todoMatch = path.match(/^\/api\/todos\/([^/]+)$/)
	if (todoMatch) {
		const id = todoMatch[1]
		if (method === 'GET') {
			const row = await env.DB.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first<TodoRow>()
			if (!row) throw new HttpError(404, 'Todo not found')
			return json({ todo: todo(row) })
		}
		if (method === 'PATCH') {
			const body = await readJson(request)
			if (!('title' in body) && !('completed' in body))
				throw new HttpError(400, 'Provide title or completed')
			const nextTitle = 'title' in body ? title(body.title) : null
			if ('completed' in body && typeof body.completed !== 'boolean')
				throw new HttpError(400, 'completed must be a boolean')
			const completed = 'completed' in body ? Number(body.completed) : null
			const row = await env.DB.prepare(
				'UPDATE todos SET title = COALESCE(?, title), completed = COALESCE(?, completed) WHERE id = ? RETURNING *',
			)
				.bind(nextTitle, completed, id)
				.first<TodoRow>()
			if (!row) throw new HttpError(404, 'Todo not found')
			return json({ todo: todo(row) })
		}
		if (method === 'DELETE') {
			const result = await env.DB.prepare('DELETE FROM todos WHERE id = ?').bind(id).run()
			if (!result.meta.changes) throw new HttpError(404, 'Todo not found')
			return new Response(null, { status: 204 })
		}
		return methodNotAllowed('GET, PATCH, DELETE')
	}
	if (path === '/api/files') {
		if (method !== 'GET') return methodNotAllowed('GET')
		const limit = Number(url.searchParams.get('limit') ?? 100)
		if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
			throw new HttpError(400, 'limit must be an integer from 1 to 1000')
		const result = await env.FILES.list({
			limit,
			cursor: url.searchParams.get('cursor') ?? undefined,
		})
		return json({
			files: result.objects.map((object) => ({
				key: object.key,
				size: object.size,
				etag: object.httpEtag,
				uploaded: object.uploaded,
			})),
			cursor: result.truncated ? result.cursor : null,
		})
	}
	if (path.startsWith('/api/files/')) {
		let key: string
		try {
			key = decodeURIComponent(path.slice('/api/files/'.length))
		} catch {
			throw new HttpError(400, 'Invalid file key encoding')
		}
		if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(key))
			throw new HttpError(
				400,
				'Use a 1–200 character filename with letters, numbers, dots, underscores or hyphens',
			)
		if (method === 'PUT') {
			const body = await readBody(request, 5 * 1024 * 1024)
			const object = await env.FILES.put(key, body, {
				httpMetadata: {
					contentType: request.headers.get('content-type') ?? 'application/octet-stream',
				},
			})
			return json({ file: { key, size: object.size, etag: object.httpEtag } }, 201)
		}
		if (method === 'GET' || method === 'HEAD') {
			const object = method === 'HEAD' ? await env.FILES.head(key) : await env.FILES.get(key)
			if (!object) throw new HttpError(404, 'File not found')
			const headers = new Headers()
			object.writeHttpMetadata(headers)
			headers.set('ETag', object.httpEtag)
			headers.set('Content-Length', String(object.size))
			headers.set('Content-Disposition', `attachment; filename="${key}"`)
			return new Response('body' in object ? (object as R2ObjectBody).body : null, { headers })
		}
		if (method === 'DELETE') {
			await env.FILES.delete(key)
			return new Response(null, { status: 204 })
		}
		return methodNotAllowed('GET, HEAD, PUT, DELETE')
	}
	throw new HttpError(404, 'Not found')
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const origin = request.headers.get('origin')
		const allowed = env.ALLOWED_ORIGINS.split(',')
			.map((value) => value.trim())
			.includes(origin ?? '')
		let response: Response
		try {
			if (origin && !allowed) throw new HttpError(403, 'Origin not allowed')
			response =
				request.method === 'OPTIONS'
					? new Response(null, { status: 204 })
					: await route(request, env)
		} catch (error) {
			if (!(error instanceof HttpError)) console.error(error)
			response = json(
				{ error: error instanceof HttpError ? error.message : 'Internal server error' },
				error instanceof HttpError ? error.status : 500,
			)
		}
		response.headers.set('Cache-Control', 'no-store')
		response.headers.set('X-Content-Type-Options', 'nosniff')
		response.headers.set('Vary', 'Origin')
		if (origin && allowed) {
			response.headers.set('Access-Control-Allow-Origin', origin)
			response.headers.set(
				'Access-Control-Allow-Methods',
				'GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS',
			)
			response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
			response.headers.set('Access-Control-Expose-Headers', 'ETag, Content-Disposition')
		}
		return response
	},
} satisfies ExportedHandler<Env>

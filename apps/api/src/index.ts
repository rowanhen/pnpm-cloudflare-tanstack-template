import type { Env } from './env'
import { trustedProxyRequest } from './proxy'
import { createAuth } from './auth'
import { HttpError, json, readBody, readJson, textField, sha256, methodNotAllowed } from './http'
import { rateLimit } from './rate-limit'
import { apiKeyUser, keysRoute } from './keys'

type TodoRow = { id: string; title: string; completed: number; created_at: string; user_id: string }
const todo = ({ user_id: _owner, ...row }: TodoRow) => ({ ...row, completed: row.completed === 1 })

async function route(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url)
	const path = url.pathname
	const method = request.method
	if (path === '/api/health') return method === 'GET' ? json({ ok: true }) : methodNotAllowed('GET')
	if (path === '/api/config')
		return json({ googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) })
	if (path.startsWith('/api/auth/')) {
		if (!env.BETTER_AUTH_SECRET)
			throw new HttpError(503, 'Run pnpm setup:local or configure the authentication secrets')
		return createAuth(env).handler(request)
	}
	if (path === '/api/waitlist' && method === 'POST') {
		const body = await readJson(request)
		if (body.website) return json({ message: "You're on the list. Thanks for your interest!" }, 202)
		const email = textField(body.email, 'email', 254).toLowerCase()
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
			throw new HttpError(400, 'Enter a valid email address')
		if (body.consent !== true) throw new HttpError(400, 'Please agree to join the waitlist')
		const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : ''
		const ip = request.headers.get('cf-connecting-ip') ?? 'local'
		await rateLimit(env.DB, `waitlist-ip:${await sha256(ip)}`, 10, 3600)
		await rateLimit(env.DB, `waitlist-email:${await sha256(email)}`, 3, 3600)
		await env.DB.prepare(
			'INSERT INTO waitlist (id, email, name, consent) VALUES (?, ?, ?, 1) ON CONFLICT(email) DO NOTHING',
		)
			.bind(crypto.randomUUID(), email, name)
			.run()
		return json({ message: "You're on the list. Thanks for your interest!" }, 202)
	}
	if (path === '/api/v1/todos') {
		if (method !== 'GET') return methodNotAllowed('GET')
		const { userId, headers } = await apiKeyUser(request, env)
		const { results } = await env.DB.prepare(
			'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100',
		)
			.bind(userId)
			.all<TodoRow>()
		const response = json({ todos: results.map(todo) })
		for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
		return response
	}
	if (!env.BETTER_AUTH_SECRET) throw new HttpError(503, 'Authentication is not configured')
	const session = await createAuth(env).api.getSession({ headers: request.headers })
	if (!session) throw new HttpError(401, 'Sign in to continue')
	const userId = session.user.id
	if (path === '/api/me' && method === 'GET') return json({ user: session.user })
	// Cookie-authenticated mutations must originate from an explicitly trusted browser origin.
	if (!['GET', 'HEAD'].includes(method)) {
		const origin = request.headers.get('origin')
		if (
			!origin ||
			!env.ALLOWED_ORIGINS.split(',')
				.map((value) => value.trim())
				.includes(origin)
		)
			throw new HttpError(403, 'A trusted Origin header is required')
	}
	if (path === '/api/keys' || path.startsWith('/api/keys/')) return keysRoute(request, env, userId)
	if (path === '/api/waitlist/me' && method === 'GET') {
		const entry = session.user.emailVerified
			? await env.DB.prepare('SELECT created_at FROM waitlist WHERE email = ?')
					.bind(session.user.email)
					.first()
			: null
		return json({ joined: Boolean(entry), entry })
	}
	if (path === '/api/todos') {
		if (method === 'GET') {
			const { results } = await env.DB.prepare(
				'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100',
			)
				.bind(userId)
				.all<TodoRow>()
			return json({ todos: results.map(todo) })
		}
		if (method === 'POST') {
			const body = await readJson(request)
			const row = await env.DB.prepare(
				'INSERT INTO todos (id, title, user_id) VALUES (?, ?, ?) RETURNING *',
			)
				.bind(crypto.randomUUID(), textField(body.title, 'title'), userId)
				.first<TodoRow>()
			return json({ todo: todo(row as TodoRow) }, 201)
		}
		return methodNotAllowed('GET, POST')
	}
	const todoMatch = path.match(/^\/api\/todos\/([^/]+)$/)
	if (todoMatch) {
		const id = todoMatch[1]
		if (method === 'GET') {
			const row = await env.DB.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?')
				.bind(id, userId)
				.first<TodoRow>()
			if (!row) throw new HttpError(404, 'Todo not found')
			return json({ todo: todo(row) })
		}
		if (method === 'PATCH') {
			const body = await readJson(request)
			if (!('title' in body) && !('completed' in body))
				throw new HttpError(400, 'Provide title or completed')
			const nextTitle = 'title' in body ? textField(body.title, 'title') : null
			if ('completed' in body && typeof body.completed !== 'boolean')
				throw new HttpError(400, 'completed must be a boolean')
			const completed = 'completed' in body ? Number(body.completed) : null
			const row = await env.DB.prepare(
				'UPDATE todos SET title = COALESCE(?, title), completed = COALESCE(?, completed) WHERE id = ? AND user_id = ? RETURNING *',
			)
				.bind(nextTitle, completed, id, userId)
				.first<TodoRow>()
			if (!row) throw new HttpError(404, 'Todo not found')
			return json({ todo: todo(row) })
		}
		if (method === 'DELETE') {
			const result = await env.DB.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?')
				.bind(id, userId)
				.run()
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
			prefix: `${userId}/`,
			cursor: url.searchParams.get('cursor') ?? undefined,
		})
		return json({
			files: result.objects.map((object) => ({
				key: object.key.slice(userId.length + 1),
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
			const object = await env.FILES.put(`${userId}/${key}`, body, {
				httpMetadata: {
					contentType: request.headers.get('content-type') ?? 'application/octet-stream',
				},
			})
			return json({ file: { key, size: object.size, etag: object.httpEtag } }, 201)
		}
		if (method === 'GET' || method === 'HEAD') {
			const object =
				method === 'HEAD'
					? await env.FILES.head(`${userId}/${key}`)
					: await env.FILES.get(`${userId}/${key}`)
			if (!object) throw new HttpError(404, 'File not found')
			const headers = new Headers()
			object.writeHttpMetadata(headers)
			headers.set('ETag', object.httpEtag)
			headers.set('Content-Length', String(object.size))
			headers.set('Content-Disposition', `attachment; filename="${key}"`)
			return new Response('body' in object ? (object as R2ObjectBody).body : null, { headers })
		}
		if (method === 'DELETE') {
			await env.FILES.delete(`${userId}/${key}`)
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
			request = await trustedProxyRequest(request, env)
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
			if (error instanceof HttpError)
				for (const [name, value] of Object.entries(error.headers)) response.headers.set(name, value)
		}
		response = new Response(response.body, response)
		response.headers.set('Cache-Control', 'no-store')
		response.headers.set('X-Content-Type-Options', 'nosniff')
		response.headers.set('Vary', 'Origin')
		if (origin && allowed) {
			response.headers.set('Access-Control-Allow-Origin', origin)
			response.headers.set('Access-Control-Allow-Credentials', 'true')
			response.headers.set(
				'Access-Control-Allow-Methods',
				'GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS',
			)
			response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
			response.headers.set(
				'Access-Control-Expose-Headers',
				'ETag, Content-Disposition, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After',
			)
		}
		return response
	},
} satisfies ExportedHandler<Env>

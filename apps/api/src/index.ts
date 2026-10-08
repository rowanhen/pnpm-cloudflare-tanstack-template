import { reportRequest } from '@workspace/observability/server'
import { safeError, safePath } from '@workspace/observability/privacy'
import { emailEnabled, emailRoute } from './email'
import { database } from '@workspace/data/client'
import { waitlist } from '@workspace/data/schema'
import { eq } from 'drizzle-orm'
import { listTodos, todosRoute } from './todos'
import { waitlistRoute } from './waitlist'
import type { Env } from './env'
import { trustedProxyRequest } from './proxy'
import { createAuth } from './auth'
import { HttpError, json, reply, readBody, methodNotAllowed } from './http'
import { apiKeyUser, keysRoute } from './keys'
import { checkoutEnabled, checkoutRoute, stripeWebhook } from './checkout'
import { billingStatus } from './billing'
import { summaryRoute } from './summary'

async function route(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url)
	const path = url.pathname
	const method = request.method
	if (path === '/api/health') return method === 'GET' ? json({ ok: true }) : methodNotAllowed('GET')
	if (path === '/api/config')
		return reply('config', {
			emailEnabled: emailEnabled(env),
			googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
			checkoutEnabled: checkoutEnabled(env),
		})
	if (path === '/api/stripe/webhook') return stripeWebhook(request, env)
	if (path.startsWith('/api/auth/')) {
		if (!env.BETTER_AUTH_SECRET)
			throw new HttpError(503, 'Run pnpm setup:local or configure the authentication secrets')
		return createAuth(env).handler(request)
	}
	if (path === '/api/waitlist' && method === 'POST') return waitlistRoute(request, env)
	if (path === '/api/v1/summary') return summaryRoute(request, env)
	if (path === '/api/v1/todos') {
		if (method !== 'GET') return methodNotAllowed('GET')
		const { userId, headers } = await apiKeyUser(request, env)
		const response = reply('todos', { todos: await listTodos(env.DB, userId) })
		for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
		return response
	}
	if (!env.BETTER_AUTH_SECRET) throw new HttpError(503, 'Authentication is not configured')
	const session = await createAuth(env).api.getSession({ headers: request.headers })
	if (!session) throw new HttpError(401, 'Sign in to continue')
	const userId = session.user.id
	if (path === '/api/billing')
		return method === 'GET' ? billingStatus(env.DB, userId) : methodNotAllowed('GET')
	if (path === '/api/me' && method === 'GET')
		return reply('me', {
			user: {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
				emailVerified: session.user.emailVerified,
				image: session.user.image ?? null,
			},
		})
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
	if (path === '/api/email')
		return emailRoute(request, env, { ...session.user, image: session.user.image ?? null })
	if (path === '/api/keys' || path.startsWith('/api/keys/')) return keysRoute(request, env, userId)
	if (path.startsWith('/api/checkout/')) return checkoutRoute(request, env, session.user)
	if (path === '/api/waitlist/me' && method === 'GET') {
		const entry = session.user.emailVerified
			? ((await database(env.DB)
					.select({ created_at: waitlist.created_at })
					.from(waitlist)
					.where(eq(waitlist.email, session.user.email))
					.get()) ?? null)
			: null
		return reply('waitlistStatus', { joined: Boolean(entry), entry })
	}
	if (path === '/api/todos' || path.startsWith('/api/todos/'))
		return todosRoute(request, env, userId)
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
		return reply('files', {
			files: result.objects.map((object) => ({
				key: object.key.slice(userId.length + 1),
				size: object.size,
				etag: object.httpEtag,
				uploaded: object.uploaded.toISOString(),
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
			return reply('file', { file: { key, size: object.size, etag: object.httpEtag } }, 201)
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
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const started = performance.now()
		const path = new URL(request.url).pathname
		let unexpectedError: unknown
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
			if (!(error instanceof HttpError)) unexpectedError = error
			response = json(
				{ error: error instanceof HttpError ? error.message : 'Internal server error' },
				error instanceof HttpError ? error.status : 500,
			)
			if (error instanceof HttpError)
				for (const [name, value] of Object.entries(error.headers)) response.headers.set(name, value)
		}
		response = new Response(response.body, response)
		const requestId = response.headers.get('X-Request-Id') ?? crypto.randomUUID()
		response.headers.set('X-Request-Id', requestId)
		if (path !== '/api/health' && request.method !== 'OPTIONS') {
			const report = {
				requestId,
				method: request.method,
				path,
				status: response.status,
				durationMs: performance.now() - started,
			}
			console.log(
				JSON.stringify({
					event: 'api.request',
					request_id: requestId,
					route: safePath(path),
					method: request.method,
					status: response.status,
					duration_ms: Math.round(report.durationMs),
				}),
			)
			if (unexpectedError !== undefined) {
				const error = safeError(unexpectedError)
				console.error(
					JSON.stringify({
						event: 'api.exception',
						request_id: requestId,
						type: error.name,
						stack: error.stack,
					}),
				)
			}
			ctx.waitUntil(reportRequest(env, { ...report, error: unexpectedError }))
		}
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
			response.headers.set(
				'Access-Control-Allow-Headers',
				'Content-Type, Authorization, Idempotency-Key',
			)
			response.headers.set(
				'Access-Control-Expose-Headers',
				'ETag, Content-Disposition, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After, X-Request-Id, X-Credits-Charged, X-Credits-Balance, X-Credits-Required, Idempotency-Replayed',
			)
		}
		return response
	},
} satisfies ExportedHandler<Env>

import { trustedOrigins } from './origins'
import { reportRequest } from '@workspace/observability/server'
import { safeError, safePath } from '@workspace/observability/privacy'
import { contractError, findOperation } from '@workspace/contracts/http'
import type { Env } from './env'
import { trustedProxyRequest } from './proxy'
import { HttpError, json } from './http'
import app from './routes/route'

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const started = performance.now()
		const path = new URL(request.url).pathname
		let unexpectedError: unknown
		const origin = request.headers.get('origin')
		const allowed = trustedOrigins(env.ALLOWED_ORIGINS).includes(origin ?? '')
		let response: Response
		try {
			request = await trustedProxyRequest(request, env)
			if (origin && !allowed) throw new HttpError(403, 'Origin not allowed')
			response =
				request.method === 'OPTIONS'
					? new Response(null, { status: 204 })
					: await app.fetch(request, env)
		} catch (error) {
			if (!(error instanceof HttpError)) unexpectedError = error
			const status = error instanceof HttpError ? error.status : 500
			const message = error instanceof HttpError ? error.message : 'Internal server error'
			const operation = findOperation(request.method, path)
			response = operation
				? contractError(operation, status, message)
				: json({ error: message }, status)
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

import { Effect, Exit, Schema } from 'effect'
import type { Handler, Operation } from '@workspace/contracts/operation'
import { contractError, contractResponse } from '@workspace/contracts/http'
import { database } from '@workspace/data/client'
import type { Handler as HonoHandler } from 'hono'
import { createAuth } from '../auth'
import type { Env } from '../env'
import { HttpError, readJson } from '../http'
import { ApiRequest } from './context'

export function effectHandler<O extends Operation>(
	operation: O,
	handler: Handler<O, ApiRequest>,
): HonoHandler<{ Bindings: Env }> {
	return async (c) => {
		try {
			if (!c.env.BETTER_AUTH_SECRET) throw new HttpError(503, 'Authentication is not configured')
			const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers })
			if (!session) throw new HttpError(401, 'Sign in to continue')
			if (!['GET', 'HEAD'].includes(c.req.method)) {
				const origin = c.req.header('origin')
				if (
					!origin ||
					!c.env.ALLOWED_ORIGINS.split(',')
						.map((v) => v.trim())
						.includes(origin)
				)
					throw new HttpError(403, 'A trusted Origin header is required')
			}
			const raw = {
				...(Object.keys(c.req.param()).length ? { params: c.req.param() } : {}),
				...(operation.hasBody ? { body: await readJson(c.req.raw) } : {}),
			}
			const parsed = Schema.decodeUnknownExit<O['input']>(operation.input, {
				onExcessProperty: 'error',
			})(raw)
			if (Exit.isFailure(parsed)) throw new HttpError(400, 'Invalid request')
			const program = handler(parsed.value).pipe(
				Effect.provideService(ApiRequest, { db: database(c.env.DB), userId: session.user.id }),
				Effect.match({ onFailure: (failure) => failure, onSuccess: (success) => success }),
			)
			const response = await Effect.runPromise(program, { signal: c.req.raw.signal })
			return contractResponse(operation, response.status, response.body)
		} catch (error) {
			if (error instanceof HttpError) return contractError(operation, error.status, error.message)
			throw error
		}
	}
}

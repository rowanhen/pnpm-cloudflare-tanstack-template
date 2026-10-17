import { Context, Effect, Exit, Schema } from 'effect'
import type { Handler, Operation } from '@workspace/contracts/operation'
import { contractError, contractResponse } from '@workspace/contracts/http'
import { database } from '@workspace/data/client'
import type { Context as HonoContext, Handler as HonoHandler } from 'hono'
import { createAuth } from '../auth'
import type { Env } from '../env'
import { HttpError, readJson } from '../http'
import { ApiRequest, PublicApiRequest } from './context'

type ApiContext = HonoContext<{ Bindings: Env }>

export const effectHandler = <O extends Operation>(operation: O, handler: Handler<O, ApiRequest>) =>
	boundary(operation, handler, async (c) => {
		if (!c.env.BETTER_AUTH_SECRET) throw new HttpError(503, 'Authentication is not configured')
		const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers })
		if (!session) throw new HttpError(401, 'Sign in to continue')
		return Context.make(ApiRequest, { db: database(c.env.DB), userId: session.user.id })
	})

export const publicEffectHandler = <O extends Operation>(
	operation: O,
	handler: Handler<O, PublicApiRequest>,
) =>
	boundary(operation, handler, async (c) =>
		Context.make(PublicApiRequest, { request: c.req.raw, env: c.env }),
	)

function boundary<O extends Operation, R>(
	operation: O,
	handler: Handler<O, R>,
	context: (c: ApiContext) => Promise<Context.Context<R>>,
): HonoHandler<{ Bindings: Env }> {
	return async (c) => {
		try {
			const services = await context(c)
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
				Effect.provide(services),
				Effect.match({ onFailure: (failure) => failure, onSuccess: (success) => success }),
			)
			const response = await Effect.runPromise(program, { signal: c.req.raw.signal })
			return contractResponse(operation, response.status, response.body)
		} catch (error) {
			if (error instanceof HttpError) {
				const response = contractError(operation, error.status, error.message)
				for (const [name, value] of Object.entries(error.headers)) response.headers.set(name, value)
				return response
			}
			throw error
		}
	}
}

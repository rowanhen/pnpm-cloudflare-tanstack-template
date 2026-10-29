import { Context, Effect, Exit, Schema } from 'effect'
import type { Handler, Operation } from '@workspace/contracts/operation'
import { contractError, contractResponse } from '@workspace/contracts/http'
import { productDatabase } from '@workspace/data/client'
import type { Context as HonoContext, Handler as HonoHandler } from 'hono'
import { createAuth } from '../auth'
import type { Env } from '../env'
import { HttpError, readJson, readBody } from '../http'
import { ApiRequest, PublicApiRequest, ApiKeyRequest } from './context'

import { apiKeyUser } from '../keys'

type ApiContext = HonoContext<{ Bindings: Env }>

export const effectHandler = <O extends Operation>(operation: O, handler: Handler<O, ApiRequest>) =>
	boundary(operation, handler, async (c) => {
		if (!c.env.BETTER_AUTH_SECRET) throw new HttpError(503, 'Authentication is not configured')
		const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers })
		if (!session) throw new HttpError(401, 'Sign in to continue')
		return Context.make(ApiRequest, {
			db: productDatabase(c.env.PRODUCT_DB),
			userId: session.user.id,
			user: {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
				emailVerified: session.user.emailVerified,
				image: session.user.image ?? null,
			},
			request: c.req.raw,
			env: c.env,
		})
	})

export const publicEffectHandler = <O extends Operation>(
	operation: O,
	handler: Handler<O, PublicApiRequest>,
) =>
	boundary(operation, handler, async (c) =>
		Context.make(PublicApiRequest, { request: c.req.raw, env: c.env }),
	)

export const apiKeyEffectHandler = <O extends Operation>(
	operation: O,
	handler: Handler<O, ApiKeyRequest>,
) =>
	boundary(operation, handler, async (c) => {
		if (!operation.scope) throw new Error('API-key operation is missing its scope')
		const identity = await apiKeyUser(c.req.raw, c.env, operation.scope)
		for (const [name, value] of Object.entries(identity.headers)) c.header(name, value)
		return Context.make(ApiKeyRequest, { request: c.req.raw, env: c.env, ...identity })
	})

function requestQuery(operation: Operation, url: string) {
	const search = new URL(url).searchParams
	const result: Record<string, unknown> = {}
	for (const [name, value] of search) {
		if (search.getAll(name).length !== 1) throw new HttpError(400, 'Repeated query parameter')
		const parameter = operation.query.find((p) => p.name === name)
		if (!parameter) throw new HttpError(400, 'Unknown query parameter')
		if (parameter.type === 'integer' && !Number.isSafeInteger(Number(value)))
			throw new HttpError(400, 'Expected an integer query parameter')
		result[name] =
			parameter.type === 'integer' || parameter.type === 'number'
				? value.trim() === ''
					? NaN
					: Number(value)
				: parameter.type === 'boolean'
					? value === 'true'
						? true
						: value === 'false'
							? false
							: value
					: value
	}
	return result
}

function boundary<O extends Operation, R>(
	operation: O,
	handler: Handler<O, R>,
	context: (c: ApiContext) => Promise<Context.Context<R>>,
): HonoHandler<{ Bindings: Env }> {
	return async (c) => {
		try {
			const services = await context(c)
			if (operation.requireOrigin && !['GET', 'HEAD'].includes(c.req.method)) {
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
				...(operation.query.length ? { query: requestQuery(operation, c.req.url) } : {}),
				...(operation.headers.length
					? {
							headers: Object.fromEntries(
								operation.headers.flatMap((name) => {
									const value = c.req.header(name)
									return value === undefined ? [] : [[name, value]]
								}),
							),
						}
					: {}),
				...(operation.hasBody
					? {
							body:
								operation.bodyKind === 'json'
									? await readJson(c.req.raw, operation.maxBodyBytes)
									: operation.bodyKind === 'raw'
										? new TextDecoder().decode(await readBody(c.req.raw, operation.maxBodyBytes))
										: new File([await readBody(c.req.raw, operation.maxBodyBytes)], 'upload', {
												type: c.req.header('content-type') ?? 'application/octet-stream',
											}),
						}
					: {}),
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
			return contractResponse(operation, response.status, response.body, response.headers)
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

// Hono dispatches HEAD through GET. Preserve explicit generated HEAD implementations.
export const headAware =
	(
		get: HonoHandler<{ Bindings: Env }>,
		head: () => HonoHandler<{ Bindings: Env }>,
	): HonoHandler<{ Bindings: Env }> =>
	(c, next) =>
		c.req.method === 'HEAD' ? head()(c, next) : get(c, next)

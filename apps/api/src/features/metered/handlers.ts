import { Effect } from 'effect'
import type { CreateSummaryHandler, ListApiTodosHandler } from '@workspace/contracts/operations'
import { ApiKeyRequest, type ApiFailure } from '../../contract/context'
import { userSummary } from '../../runtime/summary-resources'
import { chargedHeaders } from '../billing/http'
import { database } from '@workspace/data/client'
import { userTodos } from '../../runtime/user-resources'

export const createSummary: CreateSummaryHandler<ApiKeyRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiKeyRequest
		const value = yield* userSummary(ctx.env, ctx.userId).create(
			ctx.keyId,
			input.headers['idempotency-key'],
			input.body,
		)
		return {
			status: 200,
			body: value.body,
			headers: { ...ctx.headers, ...chargedHeaders(value.receipt) },
		}
	})

export const listApiTodos: ListApiTodosHandler<ApiKeyRequest, ApiFailure> = () =>
	Effect.gen(function* () {
		const context = yield* ApiKeyRequest
		const todos = yield* userTodos(database(context.env.DB), context.userId).list
		return { status: 200, body: { todos }, headers: context.headers }
	})

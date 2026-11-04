import { Effect } from 'effect'
import type { ListApiTodosHandler } from '@workspace/contracts/operations'
import { database } from '@workspace/data/client'
import { ApiKeyRequest } from '../../contract/context'
import { preserveFatal } from '../../effect-errors'
import { userTodoLayer } from '../../runtime/user-layers'
import { TodoService } from '../todos/service'

export const listApiTodos: ListApiTodosHandler<ApiKeyRequest> = () =>
	Effect.gen(function* () {
		const context = yield* ApiKeyRequest
		const todos = yield* Effect.gen(function* () {
			const service = yield* TodoService
			return yield* service.list
		}).pipe(
			Effect.provide(userTodoLayer(database(context.env.DB), context.userId)),
			preserveFatal,
			Effect.catchTag('StorageError', Effect.die),
		)
		return { status: 200, body: { todos }, headers: context.headers }
	})

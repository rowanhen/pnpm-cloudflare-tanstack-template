import { Effect } from 'effect'
import type { UpdateTodoHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { preserveFatal } from '../../effect-errors'
import { userTodoLayer } from '../../runtime/user-layers'
import { TodoService } from './service'
import { todoNotFoundResponse, invalidTodoResponse } from './http-errors'

export const updateTodo: UpdateTodoHandler<ApiRequest> = ({ params, body }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const program = Effect.gen(function* () {
			const service = yield* TodoService
			return yield* service.update(params.id, body)
		})
		const todo = yield* program.pipe(
			Effect.provide(userTodoLayer(db, userId)),
			preserveFatal,
			Effect.catchTag('TodoNotFound', todoNotFoundResponse),
			Effect.catchTag('InvalidTodo', invalidTodoResponse),
			Effect.catchTag('StorageError', Effect.die),
		)
		return { status: 200, body: { todo } }
	})

import { Effect } from 'effect'
import type { ListTodosHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { preserveFatal } from '../../effect-errors'
import { userTodoLayer } from '../../runtime/user-layers'
import { TodoService } from './service'

export const listTodos: ListTodosHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const program = Effect.gen(function* () {
			const service = yield* TodoService
			return yield* service.list
		})
		const todo = yield* program.pipe(
			Effect.provide(userTodoLayer(db, userId)),
			preserveFatal,

			Effect.catchTag('StorageError', Effect.die),
		)
		return { status: 200, body: { todos: todo } }
	})

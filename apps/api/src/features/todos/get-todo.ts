import { Effect } from 'effect'
import type { GetTodoHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { preserveFatal } from '../../effect-errors'
import { userTodoLayer } from '../../runtime/user-layers'
import { TodoService } from './service'
import { todoNotFoundResponse } from './http-errors'

export const getTodo: GetTodoHandler<ApiRequest> = ({ params }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const program = Effect.gen(function* () {
			const service = yield* TodoService
			return yield* service.get(params.id)
		})
		const todo = yield* program.pipe(
			Effect.provide(userTodoLayer(db, userId)),
			preserveFatal,
			Effect.catchTag('TodoNotFound', todoNotFoundResponse),
			Effect.catchTag('StorageError', Effect.die),
		)
		return { status: 200, body: { todo } }
	})

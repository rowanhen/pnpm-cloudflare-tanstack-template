import { Effect } from 'effect'
import type { DeleteTodoHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { preserveFatal } from '../../effect-errors'
import { userTodoLayer } from '../../runtime/user-layers'
import { TodoService } from './service'
import { todoNotFoundResponse } from './http-errors'

export const deleteTodo: DeleteTodoHandler<ApiRequest> = ({ params }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const program = Effect.gen(function* () {
			const service = yield* TodoService
			return yield* service.remove(params.id)
		})
		yield* program.pipe(
			Effect.provide(userTodoLayer(db, userId)),
			preserveFatal,
			Effect.catchTag('TodoNotFound', todoNotFoundResponse),
			Effect.catchTag('StorageError', Effect.die),
		)
		return { status: 204, body: undefined }
	})

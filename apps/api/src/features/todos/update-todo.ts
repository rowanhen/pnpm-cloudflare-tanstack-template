import { Effect } from 'effect'
import { updateTodo as operation, type UpdateTodoHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { userTodos } from '../../runtime/user-resources'
import { respond } from '../../contract/service'
import { todoError } from './http-errors'

export const updateTodo: UpdateTodoHandler<ApiRequest> = ({ params, body }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const todo = yield* respond(
			operation,
			userTodos(db, userId).update(params.id, body).pipe(Effect.mapError(todoError)),
		)
		return { status: 200, body: { todo } }
	})

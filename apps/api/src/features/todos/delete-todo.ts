import { Effect } from 'effect'
import { deleteTodo as operation, type DeleteTodoHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { userTodos } from '../../runtime/user-resources'
import { respond } from '../../contract/service'
import { todoError } from './http-errors'

export const deleteTodo: DeleteTodoHandler<ApiRequest> = ({ params }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		yield* respond(
			operation,
			userTodos(db, userId).remove(params.id).pipe(Effect.mapError(todoError)),
		)
		return { status: 204, body: undefined }
	})

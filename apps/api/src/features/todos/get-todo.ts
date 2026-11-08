import { Effect } from 'effect'
import { getTodo as operation, type GetTodoHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { userTodos } from '../../runtime/user-resources'
import { respond } from '../../contract/service'
import { todoError } from './http-errors'

export const getTodo: GetTodoHandler<ApiRequest> = ({ params }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const todo = yield* respond(
			operation,
			userTodos(db, userId).get(params.id).pipe(Effect.mapError(todoError)),
		)
		return { status: 200, body: { todo } }
	})

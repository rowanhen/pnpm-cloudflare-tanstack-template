import { Effect } from 'effect'
import { createTodo as operation, type CreateTodoHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { userTodos } from '../../runtime/user-resources'
import { respond } from '../../contract/service'
import { todoError } from './http-errors'

export const createTodo: CreateTodoHandler<ApiRequest> = ({ body }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const todo = yield* respond(
			operation,
			userTodos(db, userId).create(body.title).pipe(Effect.mapError(todoError)),
		)
		return { status: 201, body: { todo } }
	})

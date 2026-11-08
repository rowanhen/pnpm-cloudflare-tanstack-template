import { Effect } from 'effect'
import type { ListTodosHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import type { StorageError } from '../../persistence'
import { userTodos } from '../../runtime/user-resources'

export const listTodos: ListTodosHandler<ApiRequest, StorageError> = () =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const todo = yield* userTodos(db, userId).list
		return { status: 200, body: { todos: todo } }
	})

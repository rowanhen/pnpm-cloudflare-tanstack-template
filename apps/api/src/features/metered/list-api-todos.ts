import { Effect } from 'effect'
import type { ListApiTodosHandler } from '@workspace/contracts/operations'
import { database } from '@workspace/data/client'
import { ApiKeyRequest } from '../../contract/context'
import type { StorageError } from '../../persistence'
import { userTodos } from '../../runtime/user-resources'

export const listApiTodos: ListApiTodosHandler<ApiKeyRequest, StorageError> = () =>
	Effect.gen(function* () {
		const context = yield* ApiKeyRequest
		const todos = yield* userTodos(database(context.env.DB), context.userId).list
		return { status: 200, body: { todos }, headers: context.headers }
	})

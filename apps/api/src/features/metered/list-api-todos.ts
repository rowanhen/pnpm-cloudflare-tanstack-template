import { Effect } from 'effect'
import {
	listApiTodos as operation,
	type ListApiTodosHandler,
} from '@workspace/contracts/operations'
import { ApiKeyRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { listTodos } from '../todos/repository'
export const listApiTodos: ListApiTodosHandler<ApiKeyRequest> = () =>
	Effect.gen(function* () {
		const context = yield* ApiKeyRequest
		const todos = yield* attempt(operation, () => listTodos(context.env.PRODUCT_DB, context.userId))
		return { status: 200, body: { todos }, headers: context.headers }
	})

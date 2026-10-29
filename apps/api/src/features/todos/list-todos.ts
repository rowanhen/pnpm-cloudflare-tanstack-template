import { Effect } from 'effect'
import type { ListTodosHandler } from '@workspace/contracts/operations'
import { todos } from '@workspace/data/product'
import { desc, eq } from 'drizzle-orm'
import { ApiRequest } from '../../contract/context'
import { fields, query } from './repository'

export const listTodos: ListTodosHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const items = yield* query(() =>
			db
				.select(fields)
				.from(todos)
				.where(eq(todos.user_id, userId))
				.orderBy(desc(todos.created_at), desc(todos.id))
				.limit(100),
		)
		return { status: 200, body: { todos: items } }
	})

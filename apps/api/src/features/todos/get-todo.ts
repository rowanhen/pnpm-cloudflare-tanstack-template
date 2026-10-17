import { Effect } from 'effect'
import type { GetTodoHandler } from '@workspace/contracts/operations'
import { todos } from '@workspace/data/schema'
import { and, eq } from 'drizzle-orm'
import { ApiRequest } from '../../contract/context'
import { fields, query } from './repository'

export const getTodo: GetTodoHandler<ApiRequest> = ({ params }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const todo = yield* query(() =>
			db
				.select(fields)
				.from(todos)
				.where(and(eq(todos.id, params.id), eq(todos.user_id, userId)))
				.get(),
		)
		if (!todo)
			return yield* Effect.fail({
				status: 404 as const,
				body: { code: 'todo_not_found' as const, error: 'Todo not found' },
			})
		return { status: 200, body: { todo } }
	})

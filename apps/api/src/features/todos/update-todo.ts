import { Effect } from 'effect'
import type { UpdateTodoHandler } from '@workspace/contracts/operations'
import { todos } from '@workspace/data/schema'
import { and, eq } from 'drizzle-orm'
import { ApiRequest } from '../../contract/context'
import { fields, query } from './repository'

export const updateTodo: UpdateTodoHandler<ApiRequest> = ({ params, body }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const todo = yield* query(() =>
			db
				.update(todos)
				.set({ ...body, ...(body.title === undefined ? {} : { title: body.title.trim() }) })
				.where(and(eq(todos.id, params.id), eq(todos.user_id, userId)))
				.returning(fields)
				.get(),
		)
		if (!todo)
			return yield* Effect.fail({
				status: 404 as const,
				body: { code: 'todo_not_found' as const, error: 'Todo not found' },
			})
		return { status: 200, body: { todo } }
	})

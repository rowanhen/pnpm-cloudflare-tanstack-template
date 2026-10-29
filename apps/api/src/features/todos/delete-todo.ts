import { Effect } from 'effect'
import type { DeleteTodoHandler } from '@workspace/contracts/operations'
import { todos } from '@workspace/data/product'
import { and, eq } from 'drizzle-orm'
import { ApiRequest } from '../../contract/context'
import { query } from './repository'

export const deleteTodo: DeleteTodoHandler<ApiRequest> = ({ params }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const result = yield* query(() =>
			db
				.delete(todos)
				.where(and(eq(todos.id, params.id), eq(todos.user_id, userId)))
				.run(),
		)
		if (!result.meta.changes)
			return yield* Effect.fail({
				status: 404 as const,
				body: { code: 'todo_not_found' as const, error: 'Todo not found' },
			})
		return { status: 204, body: undefined }
	})

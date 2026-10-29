import { Effect } from 'effect'
import type { CreateTodoHandler } from '@workspace/contracts/operations'
import { todos } from '@workspace/data/product'
import { ApiRequest } from '../../contract/context'
import { fields, query } from './repository'

export const createTodo: CreateTodoHandler<ApiRequest> = ({ body }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const todo = yield* query(() =>
			db
				.insert(todos)
				.values({ id: crypto.randomUUID(), user_id: userId, title: body.title.trim() })
				.returning(fields)
				.get(),
		)
		return { status: 201, body: { todo } }
	})

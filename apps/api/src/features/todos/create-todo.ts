import { Effect } from 'effect'
import type { CreateTodoHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { preserveFatal } from '../../effect-errors'
import { userTodoLayer } from '../../runtime/user-layers'
import { TodoService } from './service'
import { invalidTodoResponse } from './http-errors'

export const createTodo: CreateTodoHandler<ApiRequest> = ({ body }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const program = Effect.gen(function* () {
			const service = yield* TodoService
			return yield* service.create(body.title)
		})
		const todo = yield* program.pipe(
			Effect.provide(userTodoLayer(db, userId)),
			preserveFatal,
			Effect.catchTag('InvalidTodo', invalidTodoResponse),
			Effect.catchTag('StorageError', Effect.die),
		)
		return { status: 201, body: { todo } }
	})

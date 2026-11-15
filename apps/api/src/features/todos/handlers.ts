import { Effect } from 'effect'
import type {
	CreateTodoHandler,
	DeleteTodoHandler,
	GetTodoHandler,
	ListTodosHandler,
	UpdateTodoHandler,
} from '@workspace/contracts/operations'
import { ApiRequest, type ApiFailure } from '../../contract/context'
import { userTodos } from '../../runtime/user-resources'

export const createTodo: CreateTodoHandler<ApiRequest, ApiFailure> = ({ body }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const todo = yield* userTodos(db, userId).create(body.title)
		return { status: 201, body: { todo } }
	})

export const deleteTodo: DeleteTodoHandler<ApiRequest, ApiFailure> = ({ params }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		yield* userTodos(db, userId).remove(params.id)
		return { status: 204, body: undefined }
	})

export const getTodo: GetTodoHandler<ApiRequest, ApiFailure> = ({ params }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const todo = yield* userTodos(db, userId).get(params.id)
		return { status: 200, body: { todo } }
	})

export const listTodos: ListTodosHandler<ApiRequest, ApiFailure> = () =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const todo = yield* userTodos(db, userId).list
		return { status: 200, body: { todos: todo } }
	})

export const updateTodo: UpdateTodoHandler<ApiRequest, ApiFailure> = ({ params, body }) =>
	Effect.gen(function* () {
		const { db, userId } = yield* ApiRequest
		const todo = yield* userTodos(db, userId).update(params.id, body)
		return { status: 200, body: { todo } }
	})

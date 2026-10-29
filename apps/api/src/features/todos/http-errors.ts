import { Effect } from 'effect'
import type { CreateTodoFailure, GetTodoFailure } from '@workspace/contracts/operations'
import type { InvalidTodo } from './domain'
import type { TodoNotFound } from './service'

export const invalidTodoResponse = (_error: InvalidTodo) =>
	Effect.fail({
		status: 400,
		body: { code: 'bad_request', error: 'Invalid todo' },
	} satisfies CreateTodoFailure)
export const todoNotFoundResponse = (_error: TodoNotFound) =>
	Effect.fail({
		status: 404,
		body: { code: 'todo_not_found', error: 'Todo not found' },
	} satisfies GetTodoFailure)

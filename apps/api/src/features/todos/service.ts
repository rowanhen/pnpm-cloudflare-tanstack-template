import { Context, Data, type Effect } from 'effect'
import type { Todo } from '@workspace/contracts'
import type { UpdateTodoData } from '@workspace/contracts/todos'
import type { StorageError } from '../../persistence'
import type { InvalidTodo, TodoChange, TodoTitle } from './domain'

export class TodoNotFound extends Data.TaggedError('TodoNotFound')<{}> {}

// Implementations are already bound to a trusted user; callers cannot choose another owner.
export class TodoRepository extends Context.Service<
	TodoRepository,
	{
		readonly list: Effect.Effect<readonly Todo[], StorageError>
		readonly find: (id: string) => Effect.Effect<Todo | undefined, StorageError>
		readonly create: (title: TodoTitle) => Effect.Effect<Todo, StorageError>
		readonly update: (
			id: string,
			change: TodoChange,
		) => Effect.Effect<Todo | undefined, StorageError>
		readonly remove: (id: string) => Effect.Effect<boolean, StorageError>
	}
>()('todos/Repository') {}

export class TodoService extends Context.Service<
	TodoService,
	{
		readonly list: Effect.Effect<readonly Todo[], StorageError>
		readonly get: (id: string) => Effect.Effect<Todo, StorageError | TodoNotFound>
		readonly create: (title: string) => Effect.Effect<Todo, StorageError | InvalidTodo>
		readonly update: (
			id: string,
			change: typeof UpdateTodoData.Type,
		) => Effect.Effect<Todo, StorageError | TodoNotFound | InvalidTodo>
		readonly remove: (id: string) => Effect.Effect<void, StorageError | TodoNotFound>
	}
>()('todos/Service') {}

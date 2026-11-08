import { Data, Effect, Schema } from 'effect'
import { CreateTodoData, UpdateTodoData } from '@workspace/contracts/todos'
import type { Todo } from '@workspace/contracts'
import type { StorageError } from '../../persistence'

export class InvalidTodo extends Data.TaggedError('InvalidTodo')<{}> {}

// Reuse the contract's title rule for internally constructed values too.
const Title = CreateTodoData.fields.title.pipe(Schema.brand('TodoTitle'))
export type TodoTitle = typeof Title.Type
export type TodoChange =
	| { readonly title: TodoTitle; readonly completed?: boolean }
	| { readonly title?: never; readonly completed: boolean }

export const todoTitle = (value: string) =>
	Schema.decodeEffect(Title)(value).pipe(
		Effect.flatMap((title) => Schema.decodeEffect(Title)(title.trim())),
		Effect.mapError(() => new InvalidTodo()),
	)

export const todoChange = (value: typeof UpdateTodoData.Type) =>
	Effect.gen(function* () {
		const input = yield* Schema.decodeEffect(UpdateTodoData, {
			onExcessProperty: 'error',
		})(value).pipe(Effect.mapError(() => new InvalidTodo()))
		if (input.title !== undefined)
			return {
				title: yield* todoTitle(input.title),
				completed: input.completed,
			} satisfies TodoChange
		if (input.completed !== undefined) return { completed: input.completed } satisfies TodoChange
		return yield* new InvalidTodo()
	})

export class TodoNotFound extends Data.TaggedError('TodoNotFound')<{}> {}

// The repository is already bound to a trusted owner; operations cannot select another user.
export interface TodoRepository {
	readonly list: Effect.Effect<readonly Todo[], StorageError>
	readonly find: (id: string) => Effect.Effect<Todo | undefined, StorageError>
	readonly create: (title: TodoTitle) => Effect.Effect<Todo, StorageError>
	readonly update: (id: string, change: TodoChange) => Effect.Effect<Todo | undefined, StorageError>
	readonly remove: (id: string) => Effect.Effect<boolean, StorageError>
}

const found = <A>(value: A | undefined) =>
	value === undefined ? Effect.fail(new TodoNotFound()) : Effect.succeed(value)

export const makeTodos = (repository: TodoRepository) => ({
	list: repository.list,
	get: (id: string) => repository.find(id).pipe(Effect.flatMap(found)),
	create: (title: string) => todoTitle(title).pipe(Effect.flatMap(repository.create)),
	update: (id: string, change: typeof UpdateTodoData.Type) =>
		Effect.gen(function* () {
			const valid = yield* todoChange(change)
			return yield* repository.update(id, valid).pipe(Effect.flatMap(found))
		}),
	remove: (id: string) =>
		Effect.gen(function* () {
			if (!(yield* repository.remove(id))) return yield* new TodoNotFound()
		}),
})

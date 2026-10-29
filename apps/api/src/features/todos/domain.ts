import { Data, Effect, Schema } from 'effect'
import { CreateTodoData, UpdateTodoData } from '@workspace/contracts/todos'

export class InvalidTodo extends Data.TaggedError('InvalidTodo')<{}> {}

// Reuse the contract's title rule for internally constructed values too.
const Title = CreateTodoData.fields.title.pipe(Schema.brand('TodoTitle'))
export type TodoTitle = typeof Title.Type
export type TodoChange =
	| { readonly title: TodoTitle; readonly completed?: boolean }
	| { readonly title?: never; readonly completed: boolean }

export const todoTitle = (value: string) =>
	Schema.decodeUnknownEffect(Title)(value).pipe(
		Effect.flatMap((title) => Schema.decodeUnknownEffect(Title)(title.trim())),
		Effect.mapError(() => new InvalidTodo()),
	)

export const todoChange = (value: typeof UpdateTodoData.Type) =>
	Effect.gen(function* () {
		const input = yield* Schema.decodeUnknownEffect(UpdateTodoData, {
			onExcessProperty: 'error',
		})(value).pipe(Effect.mapError(() => new InvalidTodo()))
		if (input.title !== undefined)
			return {
				title: yield* todoTitle(input.title),
				completed: input.completed,
			} satisfies TodoChange
		if (input.completed !== undefined) return { completed: input.completed } satisfies TodoChange
		return yield* Effect.fail(new InvalidTodo())
	})

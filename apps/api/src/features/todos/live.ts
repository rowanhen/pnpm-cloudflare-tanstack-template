import { Effect, Layer } from 'effect'
import { todoChange, todoTitle } from './domain'
import { TodoNotFound, TodoRepository, TodoService } from './service'

export const TodoLive = Layer.effect(
	TodoService,
	Effect.gen(function* () {
		const repository = yield* TodoRepository
		const found = <A>(value: A | undefined) =>
			value === undefined ? Effect.fail(new TodoNotFound()) : Effect.succeed(value)
		return {
			list: repository.list,
			get: (id) => repository.find(id).pipe(Effect.flatMap(found)),
			create: (title) => todoTitle(title).pipe(Effect.flatMap(repository.create)),
			update: (id, change) =>
				Effect.gen(function* () {
					const valid = yield* todoChange(change)
					return yield* repository.update(id, valid).pipe(Effect.flatMap(found))
				}),
			remove: (id) =>
				Effect.gen(function* () {
					if (!(yield* repository.remove(id))) return yield* Effect.fail(new TodoNotFound())
				}),
		}
	}),
)

import { Effect, Layer, Schema } from 'effect'
import type { productDatabase } from '@workspace/data/client'
import { todos } from '@workspace/data/product'
import { TodoData, TodoListData, TodoListLimit } from '@workspace/contracts/todos'
import { and, desc, eq } from 'drizzle-orm'
import { StorageError, storageEffect } from '../../persistence'
import { TodoRepository } from './service'

const fields = {
	id: todos.id,
	title: todos.title,
	completed: todos.completed,
	created_at: todos.created_at,
}
const decodeTodo = Schema.decodeUnknownEffect(TodoData, { onExcessProperty: 'error' })
const decodeOptionalTodo = (value: unknown) =>
	value === undefined ? Effect.succeed(undefined) : decodeTodo(value)
const storageFailure = (cause: unknown) =>
	cause instanceof StorageError ? cause : new StorageError({ cause })

export const todoRepositoryLayer = (db: ReturnType<typeof productDatabase>, userId: string) => {
	const owned = (id: string) => and(eq(todos.id, id), eq(todos.user_id, userId))
	return Layer.succeed(TodoRepository, {
		list: storageEffect(() =>
			db
				.select(fields)
				.from(todos)
				.where(eq(todos.user_id, userId))
				.orderBy(desc(todos.created_at), desc(todos.id))
				.limit(TodoListLimit),
		).pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(TodoListData, { onExcessProperty: 'error' })),
			Effect.mapError(storageFailure),
		),
		find: (id) =>
			storageEffect(() => db.select(fields).from(todos).where(owned(id)).get()).pipe(
				Effect.flatMap(decodeOptionalTodo),
				Effect.mapError(storageFailure),
			),
		create: (title) =>
			storageEffect(() =>
				db
					.insert(todos)
					.values({
						id: crypto.randomUUID(),
						user_id: userId,
						title,
					})
					.returning(fields)
					.get(),
			).pipe(Effect.flatMap(decodeTodo), Effect.mapError(storageFailure)),
		update: (id, change) =>
			storageEffect(() =>
				db.update(todos).set(change).where(owned(id)).returning(fields).get(),
			).pipe(Effect.flatMap(decodeOptionalTodo), Effect.mapError(storageFailure)),
		remove: (id) =>
			storageEffect(() => db.delete(todos).where(owned(id)).run()).pipe(
				Effect.map((result) => result.meta.changes > 0),
			),
	})
}

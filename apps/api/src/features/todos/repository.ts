import { Effect } from 'effect'
import { productDatabase } from '@workspace/data/client'
import { todos } from '@workspace/data/product'
import { desc, eq } from 'drizzle-orm'

export const fields = {
	id: todos.id,
	title: todos.title,
	completed: todos.completed,
	created_at: todos.created_at,
}
export const listTodos = (binding: Parameters<typeof productDatabase>[0], userId: string) =>
	productDatabase(binding)
		.select(fields)
		.from(todos)
		.where(eq(todos.user_id, userId))
		.orderBy(desc(todos.created_at), desc(todos.id))
		.limit(100)

// Unexpected productDatabase failures are reported and sanitized by the HTTP boundary.
export const query = <A>(run: () => PromiseLike<A>) =>
	Effect.tryPromise({
		try: () => Promise.resolve(run()),
		catch: (error) => error,
	}).pipe(Effect.orDie)

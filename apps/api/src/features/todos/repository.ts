import { Effect } from 'effect'
import { database } from '@workspace/data/client'
import { todos } from '@workspace/data/schema'
import { desc, eq } from 'drizzle-orm'

export const fields = {
	id: todos.id,
	title: todos.title,
	completed: todos.completed,
	created_at: todos.created_at,
}
export const listTodos = (binding: Parameters<typeof database>[0], userId: string) =>
	database(binding)
		.select(fields)
		.from(todos)
		.where(eq(todos.user_id, userId))
		.orderBy(desc(todos.created_at), desc(todos.id))
		.limit(100)

// Unexpected database failures are reported and sanitized by the HTTP boundary.
export const query = <A>(run: () => PromiseLike<A>) =>
	Effect.tryPromise({
		try: () => Promise.resolve(run()),
		catch: (error) => error,
	}).pipe(Effect.orDie)

import { database } from '@workspace/data/client'
import { todos } from '@workspace/data/schema'
import { and, desc, eq } from 'drizzle-orm'
import { HttpError, input, reply, methodNotAllowed } from './http'
import type { Env } from './env'

const fields = {
	id: todos.id,
	title: todos.title,
	completed: todos.completed,
	created_at: todos.created_at,
}
export const listTodos = (binding: D1Database, userId: string) =>
	database(binding)
		.select(fields)
		.from(todos)
		.where(eq(todos.user_id, userId))
		.orderBy(desc(todos.created_at), desc(todos.id))
		.limit(100)

export async function todosRoute(request: Request, env: Env, userId: string) {
	const db = database(env.DB)
	const path = new URL(request.url).pathname
	if (path === '/api/todos') {
		if (request.method === 'GET') return reply('todos', { todos: await listTodos(env.DB, userId) })
		if (request.method !== 'POST') return methodNotAllowed('GET, POST')
		const body = await input(request, 'createTodo')
		const todo = await db
			.insert(todos)
			.values({ id: crypto.randomUUID(), user_id: userId, ...body })
			.returning(fields)
			.get()
		return reply('todo', { todo }, 201)
	}
	const owner = and(eq(todos.id, path.slice('/api/todos/'.length)), eq(todos.user_id, userId))
	if (request.method === 'GET') {
		const todo = await db.select(fields).from(todos).where(owner).get()
		if (!todo) throw new HttpError(404, 'Todo not found')
		return reply('todo', { todo })
	}
	if (request.method === 'PATCH') {
		const body = await input(request, 'updateTodo')
		const todo = await db.update(todos).set(body).where(owner).returning(fields).get()
		if (!todo) throw new HttpError(404, 'Todo not found')
		return reply('todo', { todo })
	}
	if (request.method === 'DELETE') {
		const result = await db.delete(todos).where(owner).run()
		if (!result.meta.changes) throw new HttpError(404, 'Todo not found')
		return new Response(null, { status: 204 })
	}
	return methodNotAllowed('GET, PATCH, DELETE')
}

import type { Env } from '../env'
import { fileStore } from '../features/files/r2'
import type { database } from '@workspace/data/client'
import { makeTodos } from '../features/todos/todos'
import { todoRepository } from '../features/todos/repository'

// Both session and API-key adapters supply the authenticated owner here.
export const userTodos = (db: ReturnType<typeof database>, userId: string) =>
	makeTodos(todoRepository(db, userId))

export const userFiles = (env: Env, userId: string) => fileStore(env.FILES, userId)

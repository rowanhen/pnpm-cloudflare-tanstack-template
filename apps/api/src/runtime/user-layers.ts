import type { Env } from '../env'
import { fileStoreLayer } from '../features/files/r2'
import { Layer } from 'effect'
import type { productDatabase } from '@workspace/data/client'
import { TodoLive } from '../features/todos/live'
import { todoRepositoryLayer } from '../features/todos/repository'

// Called only after the session or API key boundary establishes the trusted owner.
export const userTodoLayer = (db: ReturnType<typeof productDatabase>, userId: string) =>
	TodoLive.pipe(Layer.provide(todoRepositoryLayer(db, userId)))

export const userFileLayer = (env: Env, userId: string) => fileStoreLayer(env.FILES, userId)

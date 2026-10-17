import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'
import type { D1Database } from '@cloudflare/workers-types'
export const database = (binding: D1Database) => drizzle(binding, { schema })
export type Database = ReturnType<typeof database>

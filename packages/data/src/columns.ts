import { sql } from 'drizzle-orm'
import { text, customType } from 'drizzle-orm/sqlite-core'

export const now = sql<string>`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
export const id = () => text().primaryKey().notNull()
export const created = () => text().notNull().default(now)
// SQLite stores Better Auth dates as ISO strings; the adapter reads Date values.
export const date = customType<{ data: Date; driverData: string }>({
	dataType: () => 'date',
	toDriver: (value) => value.toISOString(),
	fromDriver: (value) => new Date(value),
})
export const bigint = customType<{ data: number; driverData: number }>({ dataType: () => 'bigint' })
export const nocase = customType<{ data: string; driverData: string }>({
	dataType: () => 'text collate nocase',
})

import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core'
import { id, date, bigint, created } from './columns'

export const users = sqliteTable('users', {
	id: id(),
	name: text().notNull(),
	email: text().notNull().unique(),
	emailVerified: integer({ mode: 'boolean' }).notNull(),
	image: text(),
	createdAt: date().notNull(),
	updatedAt: date().notNull(),
})

export const sessions = sqliteTable(
	'sessions',
	{
		id: id(),
		expiresAt: date().notNull(),
		token: text().notNull().unique(),
		createdAt: date().notNull(),
		updatedAt: date().notNull(),
		ipAddress: text(),
		userAgent: text(),
		userId: text()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
	},
	(t) => [index('sessions_userId_idx').on(t.userId)],
)

export const accounts = sqliteTable(
	'accounts',
	{
		id: id(),
		accountId: text().notNull(),
		providerId: text().notNull(),
		userId: text()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text(),
		refreshToken: text(),
		idToken: text(),
		accessTokenExpiresAt: date(),
		refreshTokenExpiresAt: date(),
		scope: text(),
		password: text(),
		createdAt: date().notNull(),
		updatedAt: date().notNull(),
	},
	(t) => [index('accounts_userId_idx').on(t.userId)],
)

export const verifications = sqliteTable(
	'verifications',
	{
		id: id(),
		identifier: text().notNull(),
		value: text().notNull(),
		expiresAt: date().notNull(),
		createdAt: date().notNull(),
		updatedAt: date().notNull(),
	},
	(t) => [index('verifications_identifier_idx').on(t.identifier)],
)

export const auth_rate_limits = sqliteTable('auth_rate_limits', {
	id: id(),
	key: text().notNull().unique(),
	count: integer().notNull(),
	lastRequest: bigint().notNull(),
})

export const apiKeys = sqliteTable(
	'api_keys',
	{
		id: id(),
		user_id: text()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text().notNull(),
		key_hash: text().notNull().unique(),
		prefix: text().notNull(),
		created_at: created(),
		last_used_at: text(),
		scope: text({ enum: ['todos:read', 'summary:read'] })
			.notNull()
			.default('todos:read'),
	},
	(t) => [
		index('api_keys_user').on(t.user_id),
		check('api_keys_scope', sql`${t.scope} IN ('todos:read','summary:read')`),
	],
)

export const rateLimits = sqliteTable('rate_limits', {
	key: text().primaryKey().notNull(),
	window_start: integer().notNull(),
	count: integer().notNull(),
})

export type User = typeof users.$inferSelect
export type ApiKey = typeof apiKeys.$inferSelect

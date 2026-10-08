import { sql } from 'drizzle-orm'
import {
	sqliteTable,
	text,
	integer,
	customType,
	index,
	unique,
	check,
} from 'drizzle-orm/sqlite-core'

export const now = sql<string>`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
const id = () => text().primaryKey().notNull()
const created = () => text().notNull().default(now)
// Existing Better Auth migrations store ISO strings in SQLite DATE columns.
// Preserve that storage format while exposing Date to the adapter.
const date = customType<{ data: Date; driverData: string }>({
	dataType: () => 'date',
	toDriver: (value) => value.toISOString(),
	fromDriver: (value) => new Date(value),
})
const bigint = customType<{ data: number; driverData: number }>({ dataType: () => 'bigint' })
const nocase = customType<{ data: string; driverData: string }>({
	dataType: () => 'text collate nocase',
})

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

export const todos = sqliteTable(
	'todos',
	{
		id: id(),
		title: text().notNull(),
		completed: integer({ mode: 'boolean' }).notNull().default(false),
		created_at: created(),
		user_id: text().references(() => users.id, { onDelete: 'cascade' }),
	},
	(t) => [
		index('todos_created_at').on(sql`${t.created_at} desc`, sql`${t.id} desc`),
		index('todos_user_created').on(t.user_id, sql`${t.created_at} desc`, sql`${t.id} desc`),
		check('todos_title_length', sql`length(${t.title}) BETWEEN 1 AND 200`),
		check('todos_completed', sql`${t.completed} IN (0,1)`),
	],
)
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
export const waitlist = sqliteTable(
	'waitlist',
	{
		id: id(),
		email: nocase().notNull().unique(),
		name: text().notNull().default(''),
		consent: integer({ mode: 'boolean' }).notNull(),
		created_at: created(),
	},
	(t) => [check('waitlist_consent', sql`${t.consent} = 1`)],
)
export const rateLimits = sqliteTable('rate_limits', {
	key: text().primaryKey().notNull(),
	window_start: integer().notNull(),
	count: integer().notNull(),
})
export const orders = sqliteTable(
	'orders',
	{
		id: id(),
		user_id: text()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		request_id: text().notNull(),
		stripe_session_id: text().unique(),
		amount: integer().notNull(),
		currency: text().notNull(),
		status: text({ enum: ['pending', 'paid', 'expired', 'failed'] })
			.notNull()
			.default('pending'),
		created_at: created(),
		updated_at: created(),
		credits: integer().notNull().default(0),
		price_id: text(),
	},
	(t) => [
		unique().on(t.user_id, t.request_id),
		index('orders_user').on(t.user_id, t.created_at),
		check('orders_status', sql`${t.status} IN ('pending','paid','expired','failed')`),
		check('orders_credits', sql`${t.credits} >= 0`),
	],
)
export const stripeEvents = sqliteTable('stripe_events', { id: id(), created_at: created() })
export const creditAccounts = sqliteTable(
	'credit_accounts',
	{
		user_id: text()
			.primaryKey()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		balance: integer().notNull().default(0),
	},
	(t) => [check('credit_accounts_balance', sql`${t.balance} BETWEEN 0 AND 9007199254740991`)],
)
export const creditGrants = sqliteTable(
	'credit_grants',
	{
		id: id(),
		user_id: text()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		order_id: text()
			.notNull()
			.unique()
			.references(() => orders.id),
		credits: integer().notNull(),
		created_at: created(),
	},
	(t) => [
		index('credit_grants_user').on(t.user_id, sql`${t.created_at} desc`),
		check('credit_grants_credits', sql`${t.credits} > 0`),
	],
)
export const paidRequests = sqliteTable(
	'paid_requests',
	{
		id: id(),
		user_id: text()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		key_id: text().references(() => apiKeys.id, { onDelete: 'set null' }),
		idempotency_key: text().notNull(),
		operation: text().notNull(),
		input_hash: text().notNull(),
		credits: integer().notNull(),
		response: text().notNull(),
		created_at: created(),
	},
	(t) => [
		unique().on(t.user_id, t.idempotency_key),
		index('paid_requests_user').on(t.user_id, sql`${t.created_at} desc`),
		check('paid_requests_credits', sql`${t.credits} > 0`),
		check('paid_requests_response', sql`json_valid(${t.response})`),
	],
)

export type User = typeof users.$inferSelect
export type Todo = typeof todos.$inferSelect
export type NewTodo = typeof todos.$inferInsert
export type ApiKey = typeof apiKeys.$inferSelect
export type Order = typeof orders.$inferSelect
export type WaitlistEntry = typeof waitlist.$inferSelect

export const emailDeliveries = sqliteTable(
	'email_deliveries',
	{
		id: id(),
		dedupe_key: text().notNull().unique(),
		user_id: text().references(() => users.id, { onDelete: 'cascade' }),
		to_email: text().notNull(),
		template: text({ enum: ['waitlist', 'test'] }).notNull(),
		status: text({ enum: ['sending', 'accepted', 'failed'] })
			.notNull()
			.default('sending'),
		message_id: text(),
		error_code: text(),
		created_at: created(),
		updated_at: created(),
	},
	(t) => [
		index('email_deliveries_user').on(t.user_id, t.created_at),
		check('email_deliveries_status', sql`${t.status} IN ('sending','accepted','failed')`),
		check('email_deliveries_template', sql`${t.template} IN ('waitlist','test')`),
	],
)
export type EmailDelivery = typeof emailDeliveries.$inferSelect

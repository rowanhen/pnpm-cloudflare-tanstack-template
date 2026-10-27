import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index, unique, check } from 'drizzle-orm/sqlite-core'
import { id, created } from './columns'

export const orders = sqliteTable(
	'orders',
	{
		id: id(),
		user_id: text().notNull(),
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
		user_id: text().primaryKey().notNull(),
		balance: integer().notNull().default(0),
	},
	(t) => [check('credit_accounts_balance', sql`${t.balance} BETWEEN 0 AND 9007199254740991`)],
)

export const creditGrants = sqliteTable(
	'credit_grants',
	{
		id: id(),
		user_id: text().notNull(),
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
		user_id: text().notNull(),
		key_id: text(),
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

export type Order = typeof orders.$inferSelect

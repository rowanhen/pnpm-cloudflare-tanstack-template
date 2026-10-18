import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core'
import { id, created, nocase } from './columns'

export const todos = sqliteTable(
	'todos',
	{
		id: id(),
		title: text().notNull(),
		completed: integer({ mode: 'boolean' }).notNull().default(false),
		created_at: created(),
		user_id: text(),
	},
	(t) => [
		index('todos_created_at').on(sql`${t.created_at} desc`, sql`${t.id} desc`),
		index('todos_user_created').on(t.user_id, sql`${t.created_at} desc`, sql`${t.id} desc`),
		check('todos_title_length', sql`length(${t.title}) BETWEEN 1 AND 200`),
		check('todos_completed', sql`${t.completed} IN (0,1)`),
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

export const emailDeliveries = sqliteTable(
	'email_deliveries',
	{
		id: id(),
		dedupe_key: text().notNull().unique(),
		user_id: text(),
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

export type Todo = typeof todos.$inferSelect
export type NewTodo = typeof todos.$inferInsert
export type WaitlistEntry = typeof waitlist.$inferSelect
export type EmailDelivery = typeof emailDeliveries.$inferSelect

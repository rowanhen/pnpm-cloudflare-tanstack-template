import { database } from '@workspace/data/client'
import { creditAccounts, creditGrants, paidRequests, now } from '@workspace/data/schema'
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import { HttpError, reply } from './http'

export const CREDIT_PACK = 1_000
export const SUMMARY_COST = 1

/** For operations whose result lives entirely in D1. No network calls here. */
export async function chargeForResult(
	binding: D1Database,
	options: {
		userId: string
		keyId: string
		idempotencyKey: string
		operation: string
		inputHash: string
		cost: number
		// Application-owned, parameterized SQL yielding one JSON value.
		result: SQL<string>
	},
) {
	const db = database(binding)
	const { userId, keyId, idempotencyKey, operation, inputHash, cost, result } = options
	if (!Number.isSafeInteger(cost) || cost <= 0) throw new Error('Invalid request cost')
	const attemptId = crypto.randomUUID()
	// D1 batch is one transaction. Only this attempt's fresh receipt can debit it.
	const receipt = and(
		eq(paidRequests.user_id, userId),
		eq(paidRequests.idempotency_key, idempotencyKey),
	)
	const results = await db.batch([
		db.insert(creditAccounts).values({ user_id: userId }).onConflictDoNothing(),
		db
			.insert(paidRequests)
			.select(
				db
					.select({
						id: sql<string>`${attemptId}`.as('id'),
						user_id: sql<string>`${userId}`.as('user_id'),
						key_id: sql<string>`${keyId}`.as('key_id'),
						idempotency_key: sql<string>`${idempotencyKey}`.as('idempotency_key'),
						operation: sql<string>`${operation}`.as('operation'),
						input_hash: sql<string>`${inputHash}`.as('input_hash'),
						credits: sql<number>`${cost}`.as('credits'),
						response: sql<string>`(${result})`.as('response'),
						created_at: now.as('created_at'),
					})
					.from(sql`(select 1)`)
					.where(
						sql`(select ${creditAccounts.balance} from ${creditAccounts} where ${creditAccounts.user_id} = ${userId}) >= ${cost} AND NOT EXISTS (select 1 from ${paidRequests} where ${receipt})`,
					),
			)
			.onConflictDoNothing({ target: [paidRequests.user_id, paidRequests.idempotency_key] }),
		db
			.update(creditAccounts)
			.set({ balance: sql`${creditAccounts.balance} - ${cost}` })
			.where(
				and(
					eq(creditAccounts.user_id, userId),
					sql`EXISTS (select 1 from ${paidRequests} where ${paidRequests.id} = ${attemptId})`,
				),
			),
		db.select().from(paidRequests).where(receipt),
		db
			.select({ balance: creditAccounts.balance })
			.from(creditAccounts)
			.where(eq(creditAccounts.user_id, userId)),
	])
	const saved = results[3][0]
	const balance = results[4][0].balance
	if (!saved)
		throw new HttpError(402, 'Add credits to make this request', {
			'X-Credits-Required': String(cost),
			'X-Credits-Balance': String(balance),
		})
	if (saved.operation !== operation || saved.input_hash !== inputHash)
		throw new HttpError(409, 'Idempotency-Key was already used for a different request')
	return new Response(saved.response, {
		headers: {
			'Content-Type': 'application/json',
			'X-Request-Id': saved.id,
			'X-Credits-Charged': String(saved.id === attemptId ? saved.credits : 0),
			'X-Credits-Balance': String(balance),
			'Idempotency-Replayed': String(saved.id !== attemptId),
		},
	})
}

export async function billingStatus(binding: D1Database, userId: string) {
	const db = database(binding)
	const activity = db
		.select({
			id: creditGrants.id,
			type: sql<string>`'topup'`.as('type'),
			credits: creditGrants.credits,
			created_at: creditGrants.created_at,
		})
		.from(creditGrants)
		.where(eq(creditGrants.user_id, userId))
		.unionAll(
			db
				.select({
					id: paidRequests.id,
					type: paidRequests.operation,
					credits: sql<number>`-${paidRequests.credits}`.as('credits'),
					created_at: paidRequests.created_at,
				})
				.from(paidRequests)
				.where(eq(paidRequests.user_id, userId)),
		)
		.orderBy(desc(sql`created_at`), desc(sql`id`))
		.limit(10)
	const results = await db.batch([
		db
			.select({ balance: creditAccounts.balance })
			.from(creditAccounts)
			.where(eq(creditAccounts.user_id, userId)),
		activity,
	])
	return reply('billing', {
		balance: results[0][0]?.balance ?? 0,
		summaryCost: SUMMARY_COST,
		packCredits: CREDIT_PACK,
		activity: results[1],
	})
}

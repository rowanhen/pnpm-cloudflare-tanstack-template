import { Effect, Layer, Schema } from 'effect'
import { now } from '@workspace/data/columns'
import { billingDatabase } from '@workspace/data/client'
import { creditAccounts, creditGrants, paidRequests } from '@workspace/data/billing'
import { and, desc, eq, sql } from 'drizzle-orm'
import { BillingData } from '@workspace/contracts/values'
import { decodeStored, storageEffect } from '../../persistence'
import { BillingRepository } from './service'
import { Receipt, CREDIT_PACK, SUMMARY_COST } from './domain'
export const billingRepositoryLayer = (
	binding: Parameters<typeof billingDatabase>[0],
	userId: string,
) => {
	const db = billingDatabase(binding)
	return Layer.succeed(BillingRepository, {
		reserve: (options) =>
			Effect.gen(function* () {
				const { keyId, idempotencyKey, operation, inputHash, cost, result } = options
				const attemptId = crypto.randomUUID()
				// D1 batch is one transaction. Only this attempt's fresh receipt can debit it.
				const receipt = and(
					eq(paidRequests.user_id, userId),
					eq(paidRequests.idempotency_key, idempotencyKey),
				)
				const results = yield* storageEffect(() =>
					db.batch([
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
										response: sql<string>`${result}`.as('response'),
										created_at: now.as('created_at'),
									})
									.from(sql`(select 1)`)
									.where(
										sql`(select ${creditAccounts.balance} from ${creditAccounts} where ${creditAccounts.user_id} = ${userId}) >= ${cost} AND NOT EXISTS (select 1 from ${paidRequests} where ${receipt})`,
									),
							)
							.onConflictDoNothing({
								target: [paidRequests.user_id, paidRequests.idempotency_key],
							}),
						db
							.update(creditAccounts)
							.set({ balance: sql`${creditAccounts.balance} - ${cost}` })
							.where(
								and(
									eq(creditAccounts.user_id, userId),
									sql`EXISTS (select 1 from ${paidRequests} where ${paidRequests.id} = ${attemptId})`,
								),
							),
						db
							.select({
								id: paidRequests.id,
								operation: paidRequests.operation,
								input_hash: paidRequests.input_hash,
								credits: paidRequests.credits,
								response: paidRequests.response,
							})
							.from(paidRequests)
							.where(receipt),
						db
							.select({ balance: creditAccounts.balance })
							.from(creditAccounts)
							.where(eq(creditAccounts.user_id, userId)),
					]),
				)
				const balanceRow = yield* decodeStored(
					Schema.Struct({
						balance: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
					}),
					results[4][0],
				)
				const saved = results[3][0]
				return {
					receipt: saved === undefined ? undefined : yield* decodeStored(Receipt, saved),
					balance: balanceRow.balance,
					attemptId,
				}
			}),
		status: Effect.gen(function* () {
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
			const results = yield* storageEffect(() =>
				db.batch([
					db
						.select({ balance: creditAccounts.balance })
						.from(creditAccounts)
						.where(eq(creditAccounts.user_id, userId)),
					activity,
				]),
			)
			return yield* decodeStored(BillingData, {
				balance: results[0][0]?.balance ?? 0,
				summaryCost: SUMMARY_COST,
				packCredits: CREDIT_PACK,
				activity: results[1],
			})
		}),
	})
}

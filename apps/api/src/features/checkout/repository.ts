import { Effect, Layer, Schema } from 'effect'
import { now } from '@workspace/data/columns'
import { billingDatabase } from '@workspace/data/client'
import { orders, creditAccounts, creditGrants, stripeEvents } from '@workspace/data/billing'
import { and, eq, sql } from 'drizzle-orm'
import { decodeStored, storageEffect } from '../../persistence'
import { StoredOrder } from './domain'
import { CheckoutRepository } from './service'
const fields = {
	id: orders.id,
	user_id: orders.user_id,
	request_id: orders.request_id,
	amount: orders.amount,
	currency: orders.currency,
	credits: orders.credits,
	price_id: orders.price_id,
	status: orders.status,
	stripe_session_id: orders.stripe_session_id,
}
export const checkoutRepositoryLayer = (
	binding: Parameters<typeof billingDatabase>[0],
	fallbackPrice: string,
) => {
	const db = billingDatabase(binding)
	const decodeRow = (row: unknown) => decodeStored(StoredOrder, row)
	const find = (id: string) =>
		storageEffect(() => db.select(fields).from(orders).where(eq(orders.id, id)).get()).pipe(
			Effect.flatMap((row) =>
				row === undefined
					? Effect.succeed(undefined)
					: decodeRow({ ...row, price_id: row.price_id ?? fallbackPrice }),
			),
		)
	return Layer.succeed(CheckoutRepository, {
		find,
		reserve: (userId, requestId, offer) =>
			Effect.gen(function* () {
				yield* storageEffect(() =>
					db
						.insert(orders)
						.values({
							id: crypto.randomUUID(),
							user_id: userId,
							request_id: requestId,
							amount: offer.amount,
							currency: offer.currency,
							credits: offer.credits,
							price_id: offer.priceId,
						})
						.onConflictDoNothing({ target: [orders.user_id, orders.request_id] }),
				)
				const row = yield* storageEffect(() =>
					db
						.select(fields)
						.from(orders)
						.where(and(eq(orders.user_id, userId), eq(orders.request_id, requestId)))
						.get(),
				)
				return yield* decodeRow(
					row === undefined ? row : { ...row, price_id: row.price_id ?? fallbackPrice },
				)
			}),
		findOwned: (sessionId, userId) =>
			storageEffect(() =>
				db
					.select(fields)
					.from(orders)
					.where(and(eq(orders.stripe_session_id, sessionId), eq(orders.user_id, userId)))
					.get(),
			).pipe(
				Effect.flatMap((row) =>
					row === undefined
						? Effect.succeed(undefined)
						: decodeRow({ ...row, price_id: row.price_id ?? fallbackPrice }),
				),
			),
		received: (id) =>
			storageEffect(() =>
				db.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.id, id)).get(),
			).pipe(
				Effect.flatMap((row) =>
					row === undefined
						? Effect.succeed(false)
						: decodeStored(Schema.Struct({ id: Schema.String }), row).pipe(Effect.as(true)),
				),
			),
		reconcile: (order, sessionId, status, eventId) =>
			storageEffect(async () => {
				const grantId = crypto.randomUUID()
				// The order, immutable grant and credit balance commit in one D1 transaction.
				const update = db
					.update(orders)
					.set({
						stripe_session_id: sessionId,
						status: sql`CASE WHEN ${orders.status} = 'paid' THEN 'paid' ELSE ${status} END`,
						updated_at: now,
					})
					.where(eq(orders.id, order.id))
				const account = db
					.insert(creditAccounts)
					.values({ user_id: order.user_id })
					.onConflictDoNothing()
				const grant = db
					.insert(creditGrants)
					.select(
						db
							.select({
								id: sql<string>`${grantId}`.as('id'),
								user_id: orders.user_id,
								order_id: orders.id,
								credits: orders.credits,
								created_at: now.as('created_at'),
							})
							.from(orders)
							.where(
								and(eq(orders.id, order.id), eq(orders.status, 'paid'), sql`${orders.credits} > 0`),
							),
					)
					.onConflictDoNothing({ target: creditGrants.order_id })
				const balance = db
					.update(creditAccounts)
					.set({
						balance: sql`${creditAccounts.balance} + (select ${creditGrants.credits} from ${creditGrants} where ${creditGrants.id} = ${grantId})`,
					})
					.where(
						and(
							eq(creditAccounts.user_id, order.user_id),
							sql`EXISTS (select 1 from ${creditGrants} where ${creditGrants.id} = ${grantId})`,
						),
					)
				if (eventId)
					await db.batch([
						update,
						account,
						grant,
						balance,
						db.insert(stripeEvents).values({ id: eventId }).onConflictDoNothing(),
					])
				else await db.batch([update, account, grant, balance])
			}),
	})
}

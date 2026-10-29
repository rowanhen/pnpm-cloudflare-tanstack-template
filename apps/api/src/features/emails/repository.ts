import { Effect, Layer, Schema } from 'effect'
import { productDatabase } from '@workspace/data/client'
import { emailDeliveries } from '@workspace/data/product'
import { and, desc, eq } from 'drizzle-orm'
import { EmailStatusData } from '@workspace/contracts/values'
import { storageEffect, decodeStored, StorageError } from '../../persistence'
import { DeliveryState } from './domain'
import { EmailRepository } from './service'
export const emailRepositoryLayer = (binding: Parameters<typeof productDatabase>[0]) => {
	const db = productDatabase(binding)
	return Layer.succeed(EmailRepository, {
		reserve: (mail) =>
			Effect.gen(function* () {
				const row = yield* storageEffect(() =>
					db
						.insert(emailDeliveries)
						.values({
							id: crypto.randomUUID(),
							dedupe_key: mail.dedupeKey,
							user_id: mail.userId,
							to_email: mail.to,
							template: mail.template,
						})
						.onConflictDoNothing({ target: emailDeliveries.dedupe_key })
						.returning({ id: emailDeliveries.id })
						.get(),
				)
				if (row)
					return {
						kind: 'fresh' as const,
						id: (yield* decodeStored(Schema.Struct({ id: Schema.String }), row)).id,
					}
				const existing = yield* storageEffect(() =>
					db
						.select({
							id: emailDeliveries.id,
							status: emailDeliveries.status,
							message_id: emailDeliveries.message_id,
							error_code: emailDeliveries.error_code,
						})
						.from(emailDeliveries)
						.where(eq(emailDeliveries.dedupe_key, mail.dedupeKey))
						.get(),
				)
				return { kind: 'existing' as const, state: yield* decodeStored(DeliveryState, existing) }
			}),
		settle: (id, settlement, millis) =>
			Effect.gen(function* () {
				const result = yield* storageEffect(() =>
					db
						.update(emailDeliveries)
						.set({
							status: settlement.status,
							message_id: settlement.status === 'accepted' ? settlement.messageId : null,
							error_code: settlement.status === 'failed' ? settlement.code : null,
							updated_at: new Date(millis).toISOString(),
						})
						.where(and(eq(emailDeliveries.id, id), eq(emailDeliveries.status, 'sending')))
						.run(),
				)
				if (result.meta.changes !== 1)
					return yield* Effect.fail(new StorageError({ cause: 'Delivery claim was not owned' }))
			}),
		list: (userId) =>
			storageEffect(() =>
				db
					.select({
						id: emailDeliveries.id,
						status: emailDeliveries.status,
						created_at: emailDeliveries.created_at,
					})
					.from(emailDeliveries)
					.where(eq(emailDeliveries.user_id, userId))
					.orderBy(desc(emailDeliveries.created_at))
					.limit(10),
			).pipe(Effect.flatMap((rows) => decodeStored(EmailStatusData, rows))),
	})
}

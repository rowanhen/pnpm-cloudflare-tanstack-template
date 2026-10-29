import { Effect, Layer, Schema } from 'effect'
import { productDatabase } from '@workspace/data/client'
import { waitlist } from '@workspace/data/product'
import { eq } from 'drizzle-orm'
import { storageEffect, decodeStored } from '../../persistence'
import { WaitlistRepository } from './service'
export const waitlistRepositoryLayer = (binding: Parameters<typeof productDatabase>[0]) => {
	const db = productDatabase(binding)
	return Layer.succeed(WaitlistRepository, {
		join: (entry) =>
			storageEffect(() =>
				db
					.insert(waitlist)
					.values({ id: crypto.randomUUID(), ...entry })
					.onConflictDoNothing({ target: waitlist.email })
					.returning({ id: waitlist.id })
					.get(),
			).pipe(
				Effect.flatMap((row) =>
					row === undefined
						? Effect.succeed(undefined)
						: decodeStored(Schema.Struct({ id: Schema.String }), row).pipe(Effect.map((r) => r.id)),
				),
			),
		find: (email) =>
			storageEffect(() =>
				db
					.select({ created_at: waitlist.created_at })
					.from(waitlist)
					.where(eq(waitlist.email, email))
					.get(),
			).pipe(
				Effect.flatMap((row) =>
					row === undefined
						? Effect.succeed(undefined)
						: decodeStored(Schema.Struct({ created_at: Schema.String }), row),
				),
			),
	})
}

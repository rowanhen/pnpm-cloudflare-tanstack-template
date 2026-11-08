import { Effect, Schema } from 'effect'
import { database } from '@workspace/data/client'
import { waitlist } from '@workspace/data/product'
import { eq } from 'drizzle-orm'
import { storageEffect, decodeStored } from '../../persistence'
import type { WaitlistRepository } from './waitlist'
export const waitlistRepository = (binding: Parameters<typeof database>[0]) => {
	const db = database(binding)
	return {
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
						? Effect.undefined
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
						? Effect.undefined
						: decodeStored(Schema.Struct({ created_at: Schema.String }), row),
				),
			),
	} satisfies WaitlistRepository
}

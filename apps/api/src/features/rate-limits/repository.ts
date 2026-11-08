import { Effect, Schema } from 'effect'
import { database } from '@workspace/data/client'
import { rateLimits } from '@workspace/data/identity'
import { sql } from 'drizzle-orm'
import { storageEffect, decodeStored } from '../../persistence'
import type { RateLimitRepository } from './rate-limits'
export const rateLimitRepository = (binding: Parameters<typeof database>[0]) => {
	const db = database(binding)
	return {
		acquire: (key, limit, window) =>
			storageEffect(() =>
				db
					.insert(rateLimits)
					.values({ key, window_start: window, count: 1 })
					.onConflictDoUpdate({
						target: rateLimits.key,
						set: {
							count: sql`CASE WHEN ${rateLimits.window_start} = ${window} THEN ${rateLimits.count} + 1 ELSE 1 END`,
							window_start: window,
						},
						setWhere: sql`${rateLimits.window_start} != ${window} OR ${rateLimits.count} < ${limit}`,
					})
					.returning({ count: rateLimits.count })
					.get(),
			).pipe(
				Effect.flatMap((row) =>
					row === undefined
						? Effect.undefined
						: decodeStored(
								Schema.Struct({
									count: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
								}),
								row,
							).pipe(Effect.map((r) => r.count)),
				),
			),
	} satisfies RateLimitRepository
}

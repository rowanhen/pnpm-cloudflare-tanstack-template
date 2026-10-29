import { Effect, Layer, Schema } from 'effect'
import { identityDatabase } from '@workspace/data/client'
import { rateLimits } from '@workspace/data/identity'
import { sql } from 'drizzle-orm'
import { storageEffect, decodeStored } from '../../persistence'
import { RateLimitRepository } from './service'
export const rateLimitRepositoryLayer = (binding: Parameters<typeof identityDatabase>[0]) => {
	const db = identityDatabase(binding)
	return Layer.succeed(RateLimitRepository, {
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
						? Effect.succeed(undefined)
						: decodeStored(
								Schema.Struct({
									count: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
								}),
								row,
							).pipe(Effect.map((r) => r.count)),
				),
			),
	})
}

import { Effect, Layer, Schema } from 'effect'
import { now } from '@workspace/data/columns'
import { identityDatabase } from '@workspace/data/client'
import { apiKeys } from '@workspace/data/identity'
import type { KeyScope } from '@workspace/contracts'
import { KeysData } from '@workspace/contracts/values'
import { and, desc, eq, sql } from 'drizzle-orm'
import { decodeStored, storageEffect } from '../../persistence'
import { KeyRepository, KeyAuthenticationRepository, MAX_KEYS } from './service'
const fields = {
	id: apiKeys.id,
	name: apiKeys.name,
	prefix: apiKeys.prefix,
	scope: apiKeys.scope,
	created_at: apiKeys.created_at,
	last_used_at: apiKeys.last_used_at,
}
export const keyRepositoryLayer = (
	binding: Parameters<typeof identityDatabase>[0],
	userId: string,
) => {
	const db = identityDatabase(binding)
	return Layer.succeed(KeyRepository, {
		list: storageEffect(() =>
			db
				.select(fields)
				.from(apiKeys)
				.where(eq(apiKeys.user_id, userId))
				.orderBy(desc(apiKeys.created_at)),
		).pipe(Effect.flatMap((value) => decodeStored(KeysData, value))),
		create: (name, scope, hash, prefix) =>
			Effect.gen(function* () {
				const id = crypto.randomUUID()
				const result = yield* storageEffect(() => {
					return db
						.insert(apiKeys)
						.select(
							db
								.select({
									id: sql<string>`${id}`.as('id'),
									user_id: sql<string>`${userId}`.as('user_id'),
									name: sql<string>`${name}`.as('name'),
									key_hash: sql<string>`${hash}`.as('key_hash'),
									prefix: sql<string>`${prefix}`.as('prefix'),
									created_at: now.as('created_at'),
									last_used_at: sql<null>`null`.as('last_used_at'),
									scope: sql<KeyScope>`${scope}`.as('scope'),
								})
								.from(sql`(select 1)`)
								.where(
									sql`(select count(*) from ${apiKeys} where ${apiKeys.user_id} = ${userId}) < ${MAX_KEYS}`,
								),
						)
						.run()
				})
				return result.meta.changes ? id : undefined
			}),
		remove: (id) =>
			storageEffect(() =>
				db
					.delete(apiKeys)
					.where(and(eq(apiKeys.id, id), eq(apiKeys.user_id, userId)))
					.run(),
			).pipe(Effect.map((r) => r.meta.changes > 0)),
	})
}

export const keyAuthenticationRepositoryLayer = (
	binding: Parameters<typeof identityDatabase>[0],
) => {
	const db = identityDatabase(binding)
	return Layer.succeed(KeyAuthenticationRepository, {
		find: (hash) =>
			storageEffect(() =>
				db
					.select({ id: apiKeys.id, userId: apiKeys.user_id, scope: apiKeys.scope })
					.from(apiKeys)
					.where(eq(apiKeys.key_hash, hash))
					.get(),
			).pipe(
				Effect.flatMap((row) =>
					row === undefined
						? Effect.succeed(undefined)
						: decodeStored(
								Schema.Struct({
									id: Schema.String,
									userId: Schema.String,
									scope: KeysData.value.fields.scope,
								}),
								row,
							),
				),
			),
		touch: (id, millis) =>
			storageEffect(() =>
				db
					.update(apiKeys)
					.set({ last_used_at: new Date(millis).toISOString() })
					.where(eq(apiKeys.id, id)),
			).pipe(Effect.asVoid),
	})
}

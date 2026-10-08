import { database } from '@workspace/data/client'
import { apiKeys, now } from '@workspace/data/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { KeyScope } from '@workspace/contracts'
import type { Env } from './env'
import { HttpError, reply, input, sha256, methodNotAllowed } from './http'
import { rateLimit } from './rate-limit'

export async function keysRoute(request: Request, env: Env, userId: string) {
	const db = database(env.DB)
	const path = new URL(request.url).pathname
	if (path === '/api/keys') {
		if (request.method === 'GET') {
			const keys = await db
				.select({
					id: apiKeys.id,
					name: apiKeys.name,
					prefix: apiKeys.prefix,
					scope: apiKeys.scope,
					created_at: apiKeys.created_at,
					last_used_at: apiKeys.last_used_at,
				})
				.from(apiKeys)
				.where(eq(apiKeys.user_id, userId))
				.orderBy(desc(apiKeys.created_at))
			return reply('keys', { keys })
		}
		if (request.method === 'POST') {
			await rateLimit(env.DB, `key-create:${userId}`, 10)
			const { name, scope } = await input(request, 'createKey')
			const token = `idea_${[...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
			const id = crypto.randomUUID()
			const prefix = token.slice(0, 13)
			// Limit and insertion are one statement, including concurrent requests.
			const result = await db
				.insert(apiKeys)
				.select(
					db
						.select({
							id: sql<string>`${id}`.as('id'),
							user_id: sql<string>`${userId}`.as('user_id'),
							name: sql<string>`${name}`.as('name'),
							key_hash: sql<string>`${await sha256(token)}`.as('key_hash'),
							prefix: sql<string>`${prefix}`.as('prefix'),
							created_at: now.as('created_at'),
							last_used_at: sql<null>`null`.as('last_used_at'),
							scope: sql<KeyScope>`${scope}`.as('scope'),
						})
						.from(sql`(select 1)`)
						.where(
							sql`(select count(*) from ${apiKeys} where ${apiKeys.user_id} = ${userId}) < 10`,
						),
				)
				.run()
			if (!result.meta.changes)
				throw new HttpError(409, 'Delete an existing key before creating another (maximum 10)')
			return reply('createKey', { key: { id, name, prefix, token, scope } }, 201)
		}
		return methodNotAllowed('GET, POST')
	}
	if (request.method !== 'DELETE') return methodNotAllowed('DELETE')
	const result = await db
		.delete(apiKeys)
		.where(and(eq(apiKeys.id, path.slice('/api/keys/'.length)), eq(apiKeys.user_id, userId)))
		.run()
	if (!result.meta.changes) throw new HttpError(404, 'API key not found')
	return new Response(null, { status: 204 })
}
export async function apiKeyUser(request: Request, env: Env, scope: KeyScope = 'todos:read') {
	const db = database(env.DB)
	const token = request.headers.get('authorization')?.match(/^Bearer (idea_[a-f0-9]{64})$/)?.[1]
	if (!token) throw new HttpError(401, 'A valid API key is required')
	const key = await db
		.select({ id: apiKeys.id, user_id: apiKeys.user_id, scope: apiKeys.scope })
		.from(apiKeys)
		.where(eq(apiKeys.key_hash, await sha256(token)))
		.get()
	if (!key) throw new HttpError(401, 'Invalid or deleted API key')
	if (key.scope !== scope) throw new HttpError(403, `This endpoint requires ${scope}`)
	const headers = await rateLimit(env.DB, `api-key:${key.id}`, 30)
	await db.update(apiKeys).set({ last_used_at: now }).where(eq(apiKeys.id, key.id))
	return { userId: key.user_id, keyId: key.id, headers }
}

import type { Env } from './env'
import { HttpError, json, readJson, textField, sha256, methodNotAllowed } from './http'
import { rateLimit } from './rate-limit'

type KeyScope = 'todos:read' | 'summary:read'

export async function keysRoute(request: Request, env: Env, userId: string) {
	const path = new URL(request.url).pathname
	if (path === '/api/keys') {
		if (request.method === 'GET') {
			const { results } = await env.DB.prepare(
				'SELECT id, name, prefix, scope, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
			)
				.bind(userId)
				.all()
			return json({ keys: results })
		}
		if (request.method === 'POST') {
			await rateLimit(env.DB, `key-create:${userId}`, 10)
			const body = await readJson(request)
			const name = textField(body.name, 'name', 60)
			const scope = body.scope ?? 'todos:read'
			if (scope !== 'todos:read' && scope !== 'summary:read')
				throw new HttpError(400, 'Choose todos:read or summary:read')
			const token = `idea_${[...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
			const id = crypto.randomUUID()
			const prefix = token.slice(0, 13)
			const result =
				await env.DB.prepare(`INSERT INTO api_keys (id, user_id, name, key_hash, prefix, scope)
    SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM api_keys WHERE user_id = ?) < 10`)
					.bind(id, userId, name, await sha256(token), prefix, scope, userId)
					.run()
			if (!result.meta.changes)
				throw new HttpError(409, 'Delete an existing key before creating another (maximum 10)')
			return json({ key: { id, name, prefix, token, scope } }, 201)
		}
		return methodNotAllowed('GET, POST')
	}
	if (request.method !== 'DELETE') return methodNotAllowed('DELETE')
	const id = path.slice('/api/keys/'.length)
	const result = await env.DB.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?')
		.bind(id, userId)
		.run()
	if (!result.meta.changes) throw new HttpError(404, 'API key not found')
	return new Response(null, { status: 204 })
}

export async function apiKeyUser(request: Request, env: Env, scope: KeyScope = 'todos:read') {
	const token = request.headers.get('authorization')?.match(/^Bearer (idea_[a-f0-9]{64})$/)?.[1]
	if (!token) throw new HttpError(401, 'A valid API key is required')
	const key = await env.DB.prepare('SELECT id, user_id, scope FROM api_keys WHERE key_hash = ?')
		.bind(await sha256(token))
		.first<{ id: string; user_id: string; scope: KeyScope }>()
	if (!key) throw new HttpError(401, 'Invalid or deleted API key')
	if (key.scope !== scope) throw new HttpError(403, `This endpoint requires ${scope}`)
	const headers = await rateLimit(env.DB, `api-key:${key.id}`, 30)
	await env.DB.prepare(
		"UPDATE api_keys SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
	)
		.bind(key.id)
		.run()
	return { userId: key.user_id, keyId: key.id, headers }
}

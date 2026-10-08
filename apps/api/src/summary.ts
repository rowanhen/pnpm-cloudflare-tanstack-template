import { sql } from 'drizzle-orm'
import { todos } from '@workspace/data/schema'
import type { Env } from './env'
import { chargeForResult, SUMMARY_COST } from './billing'
import { HttpError, methodNotAllowed, input, sha256 } from './http'
import { apiKeyUser } from './keys'

export async function summaryRoute(request: Request, env: Env) {
	if (request.method !== 'POST') return methodNotAllowed('POST')
	const { userId, keyId, headers } = await apiKeyUser(request, env, 'summary:read')
	const idempotencyKey = request.headers.get('idempotency-key')
	if (!idempotencyKey || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(idempotencyKey))
		throw new HttpError(400, 'Provide a UUID Idempotency-Key header')
	const { status } = await input(request, 'summary')
	try {
		const response = await chargeForResult(env.DB, {
			userId,
			keyId,
			idempotencyKey: idempotencyKey.toLowerCase(),
			operation: 'summary',
			inputHash: await sha256(JSON.stringify({ status })),
			cost: SUMMARY_COST,
			// The private database query is the billable work in this example.
			result: sql<string>`SELECT json_object('summary', json_object(
                'total', count(*), 'completed', coalesce(sum(${todos.completed}), 0),
                'open', count(*) - coalesce(sum(${todos.completed}), 0)), 'status', ${status})
                FROM ${todos} WHERE ${todos.user_id} = ${userId} AND (${status} = 'all' OR ${todos.completed} = ${status === 'completed' ? 1 : 0})`,
		})
		for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
		return response
	} catch (error) {
		if (error instanceof HttpError) Object.assign(error.headers, headers)
		throw error
	}
}

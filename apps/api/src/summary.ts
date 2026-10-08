import type { Env } from './env'
import { chargeForResult, SUMMARY_COST } from './billing'
import { HttpError, methodNotAllowed, readJson, sha256 } from './http'
import { apiKeyUser } from './keys'

export async function summaryRoute(request: Request, env: Env) {
	if (request.method !== 'POST') return methodNotAllowed('POST')
	const { userId, keyId, headers } = await apiKeyUser(request, env, 'summary:read')
	const idempotencyKey = request.headers.get('idempotency-key')
	if (!idempotencyKey || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(idempotencyKey))
		throw new HttpError(400, 'Provide a UUID Idempotency-Key header')
	const body = await readJson(request)
	const status = body.status === undefined ? 'all' : body.status
	if (
		!['all', 'open', 'completed'].includes(status as string) ||
		Object.keys(body).some((key) => key !== 'status')
	)
		throw new HttpError(400, 'Only status is accepted: all, open or completed')
	try {
		const response = await chargeForResult(env.DB, {
			userId,
			keyId,
			idempotencyKey: idempotencyKey.toLowerCase(),
			operation: 'summary',
			inputHash: await sha256(JSON.stringify({ status })),
			cost: SUMMARY_COST,
			// The private database query is the billable work in this example.
			resultSql: `SELECT json_object('summary', json_object(
				'total', count(*), 'completed', coalesce(sum(completed), 0),
				'open', count(*) - coalesce(sum(completed), 0)), 'status', ?)
				FROM todos WHERE user_id = ? AND (? = 'all' OR completed = ?)`,
			resultParams: [status, userId, status, status === 'completed' ? 1 : 0],
		})
		for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
		return response
	} catch (error) {
		if (error instanceof HttpError) Object.assign(error.headers, headers)
		throw error
	}
}

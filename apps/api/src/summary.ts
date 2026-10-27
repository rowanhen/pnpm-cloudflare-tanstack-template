import { todos } from '@workspace/data/product'
import { productDatabase } from '@workspace/data/client'
import { and, eq, count, sum } from 'drizzle-orm'
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
		// Read product data once; billing atomically stores the chosen snapshot and debit.
		const snapshot = await productDatabase(env.PRODUCT_DB)
			.select({ total: count(), completed: sum(todos.completed) })
			.from(todos)
			.where(
				and(
					eq(todos.user_id, userId),
					status === 'all' ? undefined : eq(todos.completed, status === 'completed'),
				),
			)
			.get()
		const total = snapshot?.total ?? 0
		const completed = Number(snapshot?.completed ?? 0)
		const response = await chargeForResult(env.BILLING_DB, {
			userId,
			keyId,
			idempotencyKey: idempotencyKey.toLowerCase(),
			operation: 'summary',
			inputHash: await sha256(JSON.stringify({ status })),
			cost: SUMMARY_COST,
			result: JSON.stringify({ summary: { total, completed, open: total - completed }, status }),
		})
		for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
		return response
	} catch (error) {
		if (error instanceof HttpError) Object.assign(error.headers, headers)
		throw error
	}
}

import { todos } from '@workspace/data/product'
import { productDatabase } from '@workspace/data/client'
import { and, eq, count, sum } from 'drizzle-orm'
import type { Env } from '../../env'
import { chargeForResult, SUMMARY_COST } from '../billing/ledger'
import { sha256 } from '../../identity-hash'
import { Schema } from 'effect'
import { createSummary, type CreateSummaryInput } from '@workspace/contracts/operations'

export async function summary(env: Env, userId: string, keyId: string, input: CreateSummaryInput) {
	const idempotencyKey = input.headers['idempotency-key']
	const status = input.body.status

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
	return {
		body: Schema.decodeUnknownSync(createSummary.responses[200])(JSON.parse(response.response)),
		headers: response.headers,
	}
}

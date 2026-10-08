import { HttpError, json } from './http'

// Server-owned pricing. Orders snapshot the pack size before contacting Stripe.
export const CREDIT_PACK = 1_000
export const SUMMARY_COST = 1

type PaidRequest = {
	id: string
	operation: string
	input_hash: string
	response: string
	credits: number
}

/** For operations whose result lives entirely in D1. No network calls here. */
export async function chargeForResult(
	db: D1Database,
	options: {
		userId: string
		keyId: string
		idempotencyKey: string
		operation: string
		inputHash: string
		cost: number
		// Application-owned SQL yielding one JSON value; never accept SQL from a caller.
		resultSql: string
		resultParams: unknown[]
	},
) {
	const { userId, keyId, idempotencyKey, operation, inputHash, cost, resultSql, resultParams } =
		options
	if (!Number.isSafeInteger(cost) || cost <= 0) throw new Error('Invalid request cost')
	const attemptId = crypto.randomUUID()
	// D1 executes a batch as one transaction. Only the insertion with this fresh
	// attempt ID can debit the account. Retries and competing requests cannot debit it twice.
	const results = await db.batch([
		db
			.prepare('INSERT INTO credit_accounts(user_id) VALUES (?) ON CONFLICT DO NOTHING')
			.bind(userId),
		db
			.prepare(`INSERT INTO paid_requests
			(id, user_id, key_id, idempotency_key, operation, input_hash, credits, response)
			SELECT ?, ?, ?, ?, ?, ?, ?, (${resultSql})
			WHERE (SELECT balance FROM credit_accounts WHERE user_id = ?) >= ?
			AND NOT EXISTS (SELECT 1 FROM paid_requests WHERE user_id = ? AND idempotency_key = ?)
			ON CONFLICT(user_id, idempotency_key) DO NOTHING`)
			.bind(
				attemptId,
				userId,
				keyId,
				idempotencyKey,
				operation,
				inputHash,
				cost,
				...resultParams,
				userId,
				cost,
				userId,
				idempotencyKey,
			),
		db
			.prepare(`UPDATE credit_accounts SET balance = balance - ? WHERE user_id = ?
			AND EXISTS (SELECT 1 FROM paid_requests WHERE id = ?)`)
			.bind(cost, userId, attemptId),
		db
			.prepare(
				'SELECT id, operation, input_hash, response, credits FROM paid_requests WHERE user_id = ? AND idempotency_key = ?',
			)
			.bind(userId, idempotencyKey),
		db.prepare('SELECT balance FROM credit_accounts WHERE user_id = ?').bind(userId),
	])
	const saved = results[3].results[0] as PaidRequest | undefined
	const balance = Number((results[4].results[0] as { balance: number }).balance)
	if (!saved)
		throw new HttpError(402, 'Add credits to make this request', {
			'X-Credits-Required': String(cost),
			'X-Credits-Balance': String(balance),
		})
	if (saved.operation !== operation || saved.input_hash !== inputHash)
		throw new HttpError(409, 'Idempotency-Key was already used for a different request')
	return new Response(saved.response, {
		headers: {
			'Content-Type': 'application/json',
			'X-Request-Id': saved.id,
			'X-Credits-Charged': String(saved.id === attemptId ? saved.credits : 0),
			'X-Credits-Balance': String(balance),
			'Idempotency-Replayed': String(saved.id !== attemptId),
		},
	})
}

export async function billingStatus(db: D1Database, userId: string) {
	const results = await db.batch([
		db.prepare('SELECT balance FROM credit_accounts WHERE user_id = ?').bind(userId),
		db
			.prepare(`SELECT id, 'topup' AS type, credits, created_at FROM credit_grants WHERE user_id = ?
			UNION ALL SELECT id, operation AS type, -credits AS credits, created_at FROM paid_requests WHERE user_id = ?
			ORDER BY created_at DESC, id DESC LIMIT 10`)
			.bind(userId, userId),
	])
	return json({
		balance: Number((results[0].results[0] as { balance: number } | undefined)?.balance ?? 0),
		summaryCost: SUMMARY_COST,
		packCredits: CREDIT_PACK,
		activity: results[1].results,
	})
}

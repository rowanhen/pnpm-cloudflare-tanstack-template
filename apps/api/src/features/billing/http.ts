import type { Charged } from './domain'
export const chargedHeaders = (receipt: Charged) => ({
	'Content-Type': 'application/json',
	'X-Request-Id': receipt.requestId,
	'X-Credits-Charged': String(receipt.charged),
	'X-Credits-Balance': String(receipt.balance),
	'Idempotency-Replayed': String(receipt.replayed),
})

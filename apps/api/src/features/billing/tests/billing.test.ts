import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Effect, Result } from 'effect'
import { makeBilling } from '../billing.ts'
import { InsufficientCredits, Conflict } from '../../../errors.ts'
const requestId = '00000000-0000-4000-8000-000000000001'

describe('billing', () => {
	test('when billing requests differ or repeat, balances and conflicts reflect the request', async () => {
		for (const receipt of [
			undefined,
			{ id: 'saved', operation: 'other', input_hash: 'hash', credits: 1, response: '{}' },
			{ id: 'saved', operation: 'summary', input_hash: 'hash', credits: 1, response: '{}' },
		]) {
			const service = makeBilling({
				repository: {
					status: Effect.succeed({ balance: 3, activity: [], packCredits: 1000, summaryCost: 1 }),
					reserve: () => Effect.succeed({ receipt, balance: 3, attemptId: 'new' }),
				},
			})
			const result = await Effect.runPromise(
				service
					.charge({
						keyId: 'key',
						idempotencyKey: requestId,
						operation: 'summary',
						inputHash: 'hash',
						cost: 1,
						result: '{}',
					})
					.pipe(Effect.result),
			)
			if (!receipt) {
				assert.ok(Result.isFailure(result))
				if (Result.isFailure(result)) assert.ok(result.failure instanceof InsufficientCredits)
			} else if (receipt.operation !== 'summary') {
				assert.ok(Result.isFailure(result))
				if (Result.isFailure(result)) assert.ok(result.failure instanceof Conflict)
			} else {
				assert.ok(Result.isSuccess(result))
				if (Result.isSuccess(result)) assert.equal(result.success.charged, 0)
			}
		}
	})
})

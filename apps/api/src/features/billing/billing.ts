import { Effect } from 'effect'
import type { BillingStatus } from '@workspace/contracts'
import type { StorageError } from '../../persistence'
import { Conflict, InsufficientCredits } from '../../errors'
import type { Charge, Receipt } from './domain'
export type BillingRepository = {
	readonly reserve: (
		charge: Charge,
	) => Effect.Effect<
		{ receipt: Receipt | undefined; balance: number; attemptId: string },
		StorageError
	>
	readonly status: Effect.Effect<BillingStatus, StorageError>
}
export type BillingLedger = ReturnType<typeof makeBilling>

export const makeBilling = ({ repository }: { repository: BillingRepository }) => {
	return {
		status: repository.status,
		charge: (input: Charge) =>
			Effect.gen(function* () {
				if (!Number.isSafeInteger(input.cost) || input.cost <= 0)
					return yield* Effect.die(new Error('Invalid request cost'))
				const { receipt, balance, attemptId } = yield* repository.reserve(input)
				if (!receipt) return yield* new InsufficientCredits({ required: input.cost, balance })
				if (receipt.operation !== input.operation || receipt.input_hash !== input.inputHash)
					return yield* new Conflict({
						message: 'Idempotency-Key was already used for a different request',
					})
				return {
					response: receipt.response,
					requestId: receipt.id,
					charged: receipt.id === attemptId ? receipt.credits : 0,
					balance,
					replayed: receipt.id !== attemptId,
				}
			}),
	}
}

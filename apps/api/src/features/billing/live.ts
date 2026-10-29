import { Effect, Layer } from 'effect'
import { Conflict, InsufficientCredits } from '../../errors'
import { BillingLedger, BillingRepository } from './service'
export const BillingLive = Layer.effect(
	BillingLedger,
	Effect.gen(function* () {
		const repository = yield* BillingRepository
		return {
			status: repository.status,
			charge: (input) =>
				Effect.gen(function* () {
					if (!Number.isSafeInteger(input.cost) || input.cost <= 0)
						return yield* Effect.die(new Error('Invalid request cost'))
					const { receipt, balance, attemptId } = yield* repository.reserve(input)
					if (!receipt)
						return yield* Effect.fail(new InsufficientCredits({ required: input.cost, balance }))
					if (receipt.operation !== input.operation || receipt.input_hash !== input.inputHash)
						return yield* Effect.fail(
							new Conflict({ message: 'Idempotency-Key was already used for a different request' }),
						)
					return {
						response: receipt.response,
						requestId: receipt.id,
						charged: receipt.id === attemptId ? receipt.credits : 0,
						balance,
						replayed: receipt.id !== attemptId,
					}
				}),
		}
	}),
)

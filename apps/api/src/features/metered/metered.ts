import { Effect } from 'effect'
import { type SummaryData, SummaryInput, SummaryIdempotencyKey } from '@workspace/contracts/values'
import type { StorageError } from '../../persistence'
import { SUMMARY_COST } from '../billing/domain'
import { validate } from '../../validation'
import type { IdentityCrypto } from '../../identity'
import { SummaryResult } from './domain'
import type { BillingLedger } from '../billing/billing'
export type SummaryRepository = {
	readonly decodeReplay: (value: string) => Effect.Effect<typeof SummaryData.Type, StorageError>
	readonly snapshot: (
		status: typeof SummaryInput.Type.status,
	) => Effect.Effect<{ total: number; completed: number }, StorageError>
}

export const makeSummary = ({
	repository,
	billing,
	crypto,
}: {
	repository: SummaryRepository
	billing: Pick<BillingLedger, 'charge'>
	crypto: IdentityCrypto
}) => {
	return {
		create: (keyId: string, rawKey: string, input: typeof SummaryInput.Type) =>
			Effect.gen(function* () {
				const { status } = yield* validate(SummaryInput, input)
				const idempotencyKey = (yield* validate(SummaryIdempotencyKey, rawKey)).toLowerCase()
				const { total, completed } = yield* repository.snapshot(status)
				const prepared = yield* validate(SummaryResult, {
					summary: { total, completed, open: total - completed },
					status,
				})
				const receipt = yield* billing.charge({
					keyId,
					idempotencyKey,
					operation: 'summary',
					inputHash: yield* crypto.hash(JSON.stringify({ status })),
					cost: SUMMARY_COST,
					result: JSON.stringify(prepared),
				})
				const body = yield* repository.decodeReplay(receipt.response)
				return { body, receipt }
			}),
	}
}

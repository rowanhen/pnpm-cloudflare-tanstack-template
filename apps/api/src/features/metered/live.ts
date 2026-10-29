import { Effect, Layer } from 'effect'
import { SummaryInput, SummaryIdempotencyKey } from '@workspace/contracts/values'
import { validate } from '../../validation'
import { IdentityCrypto } from '../../identity'
import { SummaryResult } from './domain'
import { BillingLedger } from '../billing/service'
import { SUMMARY_COST } from '../billing/domain'
import { SummaryRepository, SummaryService } from './service'
export const SummaryLive = Layer.effect(
	SummaryService,
	Effect.gen(function* () {
		const repository = yield* SummaryRepository
		const billing = yield* BillingLedger
		const crypto = yield* IdentityCrypto
		return {
			create: (keyId, rawKey, input) =>
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
	}),
)

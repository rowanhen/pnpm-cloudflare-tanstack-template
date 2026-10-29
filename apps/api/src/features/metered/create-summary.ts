import { Effect } from 'effect'
import {
	createSummary as operation,
	type CreateSummaryHandler,
} from '@workspace/contracts/operations'
import { ApiKeyRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { SummaryService } from './service'
import { summaryLayer } from '../../runtime/summary-layers'
import { chargedHeaders } from '../billing/http'

export const createSummary: CreateSummaryHandler<ApiKeyRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiKeyRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(SummaryService, (s) =>
				s.create(ctx.keyId, input.headers['idempotency-key'], input.body),
			).pipe(Effect.provide(summaryLayer(ctx.env, ctx.userId))),
		)
		return {
			status: 200,
			body: value.body,
			headers: { ...ctx.headers, ...chargedHeaders(value.receipt) },
		}
	})

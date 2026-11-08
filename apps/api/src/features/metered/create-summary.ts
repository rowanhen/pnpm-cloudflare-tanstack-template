import { Effect } from 'effect'
import {
	createSummary as operation,
	type CreateSummaryHandler,
} from '@workspace/contracts/operations'
import { ApiKeyRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userSummary } from '../../runtime/summary-resources'
import { chargedHeaders } from '../billing/http'

export const createSummary: CreateSummaryHandler<ApiKeyRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiKeyRequest
		const value = yield* respond(
			operation,
			userSummary(ctx.env, ctx.userId).create(
				ctx.keyId,
				input.headers['idempotency-key'],
				input.body,
			),
		)
		return {
			status: 200,
			body: value.body,
			headers: { ...ctx.headers, ...chargedHeaders(value.receipt) },
		}
	})

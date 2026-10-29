import { Effect } from 'effect'
import {
	createSummary as operation,
	type CreateSummaryHandler,
} from '@workspace/contracts/operations'
import { ApiKeyRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { summary } from './summary'
export const createSummary: CreateSummaryHandler<ApiKeyRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* ApiKeyRequest
		const result = yield* attempt(operation, () =>
			summary(context.env, context.userId, context.keyId, input),
		)
		return { status: 200, ...result, headers: { ...context.headers, ...result.headers } }
	})

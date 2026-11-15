import { Effect } from 'effect'
import type { GetBillingHandler } from '@workspace/contracts/operations'
import { ApiRequest, type ApiFailure } from '../../contract/context'
import { userBilling } from '../../runtime/billing-resources'

export const getBilling: GetBillingHandler<ApiRequest, ApiFailure> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* userBilling(ctx.env, ctx.userId).status
		return { status: 200, body: value }
	})

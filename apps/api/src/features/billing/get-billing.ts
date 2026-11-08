import { Effect } from 'effect'
import { getBilling as operation, type GetBillingHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userBilling } from '../../runtime/billing-resources'

export const getBilling: GetBillingHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(operation, userBilling(ctx.env, ctx.userId).status)
		return { status: 200, body: value }
	})

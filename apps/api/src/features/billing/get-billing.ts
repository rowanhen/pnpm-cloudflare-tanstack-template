import { Effect } from 'effect'
import { getBilling as operation, type GetBillingHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { billingStatus } from './ledger'
export const getBilling: GetBillingHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const body = yield* attempt(operation, () =>
			billingStatus(context.env.BILLING_DB, context.userId),
		)
		return { status: 200, body }
	})

import { Effect } from 'effect'
import { getBilling as operation, type GetBillingHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { BillingLedger } from '../billing/service'
import { billingLayer } from '../../runtime/billing-layers'

export const getBilling: GetBillingHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(BillingLedger, (s) => s.status).pipe(
				Effect.provide(billingLayer(ctx.env, ctx.userId)),
			),
		)
		return { status: 200, body: value }
	})

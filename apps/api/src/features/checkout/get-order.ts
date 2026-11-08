import { Effect } from 'effect'
import { getOrder as operation, type GetOrderHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userCheckout } from '../../runtime/checkout-resources'

export const getOrder: GetOrderHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			userCheckout(ctx.env, ctx.user).get(input.params.sessionId),
		)
		return { status: 200, body: value }
	})

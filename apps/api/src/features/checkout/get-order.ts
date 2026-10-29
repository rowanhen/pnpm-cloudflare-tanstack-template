import { Effect } from 'effect'
import { getOrder as operation, type GetOrderHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { CheckoutService } from './service'
import { checkoutLayer } from '../../runtime/checkout-layers'

export const getOrder: GetOrderHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(CheckoutService, (s) => s.get(input.params.sessionId)).pipe(
				Effect.provide(checkoutLayer(ctx.env, ctx.user)),
			),
		)
		return { status: 200, body: value }
	})

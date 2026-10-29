import { Effect } from 'effect'
import {
	createCheckout as operation,
	type CreateCheckoutHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { CheckoutService } from './service'
import { checkoutLayer } from '../../runtime/checkout-layers'

export const createCheckout: CreateCheckoutHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(CheckoutService, (s) => s.create(input.body)).pipe(
				Effect.provide(checkoutLayer(ctx.env, ctx.user)),
			),
		)
		return { status: 201, body: value }
	})

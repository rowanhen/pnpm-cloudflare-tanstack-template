import { Effect } from 'effect'
import {
	createCheckout as operation,
	type CreateCheckoutHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userCheckout } from '../../runtime/checkout-resources'

export const createCheckout: CreateCheckoutHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(operation, userCheckout(ctx.env, ctx.user).create(input.body))
		return { status: 201, body: value }
	})

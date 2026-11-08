import { Effect } from 'effect'
import {
	getCheckoutConfig as operation,
	type GetCheckoutConfigHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userCheckout } from '../../runtime/checkout-resources'

export const getCheckoutConfig: GetCheckoutConfigHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(operation, userCheckout(ctx.env, ctx.user).config)
		return { status: 200, body: value }
	})

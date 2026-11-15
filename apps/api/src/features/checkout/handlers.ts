import { Effect } from 'effect'
import type {
	CreateCheckoutHandler,
	GetCheckoutConfigHandler,
	GetOrderHandler,
} from '@workspace/contracts/operations'
import { ApiRequest, type ApiFailure } from '../../contract/context'
import { userCheckout } from '../../runtime/checkout-resources'

export const createCheckout: CreateCheckoutHandler<ApiRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* userCheckout(ctx.env, ctx.user).create(input.body)
		return { status: 201, body: value }
	})

export const getCheckoutConfig: GetCheckoutConfigHandler<ApiRequest, ApiFailure> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* userCheckout(ctx.env, ctx.user).config
		return { status: 200, body: value }
	})

export const getOrder: GetOrderHandler<ApiRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* userCheckout(ctx.env, ctx.user).get(input.params.sessionId)
		return { status: 200, body: value }
	})

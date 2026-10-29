import { Effect } from 'effect'
import {
	createCheckout as operation,
	type CreateCheckoutHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { createCheckout as service } from './stripe'
export const createCheckout: CreateCheckoutHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const body = yield* attempt(operation, () => service(context.env, context.user, input.body))
		return { status: 201, body }
	})

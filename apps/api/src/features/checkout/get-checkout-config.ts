import { Effect } from 'effect'
import {
	getCheckoutConfig as operation,
	type GetCheckoutConfigHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { checkoutConfig } from '../../checkout'
export const getCheckoutConfig: GetCheckoutConfigHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const body = yield* attempt(operation, () => checkoutConfig(context.env))
		return { status: 200, body }
	})

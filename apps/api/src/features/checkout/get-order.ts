import { Effect } from 'effect'
import { getOrder as operation, type GetOrderHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { getOrder as service } from '../../checkout'
export const getOrder: GetOrderHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const body = yield* attempt(operation, () =>
			service(context.env, context.user, input.params.sessionId),
		)
		return { status: 200, body }
	})

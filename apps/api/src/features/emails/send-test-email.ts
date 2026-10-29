import { Effect } from 'effect'
import {
	sendTestEmail as operation,
	type SendTestEmailHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { sendTestEmail as service } from '../../email'
export const sendTestEmail: SendTestEmailHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const body = yield* attempt(operation, () =>
			service(context.env, context.user, input.body.requestId),
		)
		return { status: 202, body }
	})

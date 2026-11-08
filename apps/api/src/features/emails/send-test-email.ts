import { Effect } from 'effect'
import {
	sendTestEmail as operation,
	type SendTestEmailHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { emails } from '../../runtime/email-resources'

export const sendTestEmail: SendTestEmailHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(operation, emails(ctx.env).test(ctx.user, input.body.requestId))
		return { status: 202, body: { email: value } }
	})

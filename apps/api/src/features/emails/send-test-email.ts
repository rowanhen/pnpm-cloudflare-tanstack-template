import { Effect } from 'effect'
import {
	sendTestEmail as operation,
	type SendTestEmailHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { EmailService } from './service'
import { emailLayer } from '../../runtime/email-layers'

export const sendTestEmail: SendTestEmailHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(EmailService, (s) => s.test(ctx.user, input.body.requestId)).pipe(
				Effect.provide(emailLayer(ctx.env)),
			),
		)
		return { status: 202, body: { email: value } }
	})

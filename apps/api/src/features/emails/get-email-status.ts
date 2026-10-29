import { Effect } from 'effect'
import {
	getEmailStatus as operation,
	type GetEmailStatusHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { EmailService } from './service'
import { emailLayer } from '../../runtime/email-layers'

export const getEmailStatus: GetEmailStatusHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(EmailService, (s) => s.status(ctx.userId)).pipe(
				Effect.provide(emailLayer(ctx.env)),
			),
		)
		return { status: 200, body: value }
	})

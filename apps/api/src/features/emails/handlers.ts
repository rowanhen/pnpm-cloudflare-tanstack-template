import { Effect } from 'effect'
import type { GetEmailStatusHandler, SendTestEmailHandler } from '@workspace/contracts/operations'
import { ApiRequest, type ApiFailure } from '../../contract/context'
import { emails } from '../../runtime/email-resources'

export const getEmailStatus: GetEmailStatusHandler<ApiRequest, ApiFailure> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* emails(ctx.env).status(ctx.userId)
		return { status: 200, body: value }
	})

export const sendTestEmail: SendTestEmailHandler<ApiRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* emails(ctx.env).test(ctx.user, input.body.requestId)
		return { status: 202, body: { email: value } }
	})

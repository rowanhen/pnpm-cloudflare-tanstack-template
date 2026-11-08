import { Effect } from 'effect'
import {
	getEmailStatus as operation,
	type GetEmailStatusHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { emails } from '../../runtime/email-resources'

export const getEmailStatus: GetEmailStatusHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(operation, emails(ctx.env).status(ctx.userId))
		return { status: 200, body: value }
	})

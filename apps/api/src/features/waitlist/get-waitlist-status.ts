import { Effect } from 'effect'
import {
	getWaitlistStatus as operation,
	type GetWaitlistStatusHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { waitlist } from '../../runtime/waitlist-resources'

export const getWaitlistStatus: GetWaitlistStatusHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(operation, waitlist(ctx.env).status(ctx.user))
		return { status: 200, body: value }
	})

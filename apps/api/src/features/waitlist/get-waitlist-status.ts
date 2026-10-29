import { Effect } from 'effect'
import {
	getWaitlistStatus as operation,
	type GetWaitlistStatusHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { WaitlistService } from './service'
import { waitlistLayer } from '../../runtime/waitlist-layers'

export const getWaitlistStatus: GetWaitlistStatusHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(WaitlistService, (s) => s.status(ctx.user)).pipe(
				Effect.provide(waitlistLayer(ctx.env)),
			),
		)
		return { status: 200, body: value }
	})

import { Effect } from 'effect'
import type { GetWaitlistStatusHandler, JoinWaitlistHandler } from '@workspace/contracts/operations'
import { ApiRequest, PublicApiRequest, type ApiFailure } from '../../contract/context'
import { waitlist } from '../../runtime/waitlist-resources'

export const getWaitlistStatus: GetWaitlistStatusHandler<ApiRequest, ApiFailure> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* waitlist(ctx.env).status(ctx.user)
		return { status: 200, body: value }
	})

export const joinWaitlist: JoinWaitlistHandler<PublicApiRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* waitlist(ctx.env).join(
			input.body,
			ctx.request.headers.get('cf-connecting-ip') ?? 'local',
		)
		return { status: 202, body: value }
	})

import { Effect } from 'effect'
import {
	joinWaitlist as operation,
	type JoinWaitlistHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { waitlist } from '../../runtime/waitlist-resources'

export const joinWaitlist: JoinWaitlistHandler<PublicApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* respond(
			operation,
			waitlist(ctx.env).join(input.body, ctx.request.headers.get('cf-connecting-ip') ?? 'local'),
		)
		return { status: 202, body: value }
	})

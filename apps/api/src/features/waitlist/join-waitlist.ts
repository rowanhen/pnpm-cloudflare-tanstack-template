import { Effect } from 'effect'
import {
	joinWaitlist as operation,
	type JoinWaitlistHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { WaitlistService } from './service'
import { waitlistLayer } from '../../runtime/waitlist-layers'

export const joinWaitlist: JoinWaitlistHandler<PublicApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* PublicApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(WaitlistService, (s) =>
				s.join(input.body, ctx.request.headers.get('cf-connecting-ip') ?? 'local'),
			).pipe(Effect.provide(waitlistLayer(ctx.env))),
		)
		return { status: 202, body: value }
	})

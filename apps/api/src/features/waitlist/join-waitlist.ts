import { Effect } from 'effect'
import {
	joinWaitlist as operation,
	type JoinWaitlistHandler,
} from '@workspace/contracts/operations'
import { PublicApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { joinWaitlist as service } from './registration'
export const joinWaitlist: JoinWaitlistHandler<PublicApiRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* PublicApiRequest
		const body = yield* attempt(operation, () => service(context.request, context.env, input.body))
		return { status: 202, body }
	})

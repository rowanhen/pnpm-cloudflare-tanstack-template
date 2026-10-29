import { Effect } from 'effect'
import { type GetMeHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'

export const getMe: GetMeHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		return { status: 200, body: { user: context.user } }
	})

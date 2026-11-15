import { Effect } from 'effect'
import type { GetMeHandler } from '@workspace/contracts/operations'
import { ApiRequest, type ApiFailure } from '../../contract/context'

export const getMe: GetMeHandler<ApiRequest, ApiFailure> = () =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		return { status: 200, body: { user: context.user } }
	})

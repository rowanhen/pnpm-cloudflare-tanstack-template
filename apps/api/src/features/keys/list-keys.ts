import { Effect } from 'effect'
import { listKeys as operation, type ListKeysHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userKeys } from '../../runtime/key-resources'

export const listKeys: ListKeysHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(operation, userKeys(ctx.env, ctx.userId).list)
		return { status: 200, body: { keys: value } }
	})

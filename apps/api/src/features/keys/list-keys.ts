import { Effect } from 'effect'
import { listKeys as operation, type ListKeysHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { listKeys as service } from '../../keys'
export const listKeys: ListKeysHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const body = yield* attempt(operation, () => service(context.env, context.userId))
		return { status: 200, body }
	})

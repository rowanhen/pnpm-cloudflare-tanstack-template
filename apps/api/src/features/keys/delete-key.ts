import { Effect } from 'effect'
import { deleteKey as operation, type DeleteKeyHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userKeys } from '../../runtime/key-resources'

export const deleteKey: DeleteKeyHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		yield* respond(operation, userKeys(ctx.env, ctx.userId).remove(input.params.id))
		return { status: 204, body: undefined }
	})

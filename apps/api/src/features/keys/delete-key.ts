import { Effect } from 'effect'
import { deleteKey as operation, type DeleteKeyHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { deleteKey as service } from '../../keys'
export const deleteKey: DeleteKeyHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		yield* attempt(operation, () => service(context.env, context.userId, input.params.id))
		return { status: 204, body: undefined }
	})

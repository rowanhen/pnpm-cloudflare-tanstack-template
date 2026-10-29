import { Effect } from 'effect'
import { deleteFile as operation, type DeleteFileHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'

export const deleteFile: DeleteFileHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		yield* attempt(operation, () =>
			context.env.FILES.delete(`${context.userId}/${input.params.key}`),
		)
		return { status: 204, body: undefined }
	})

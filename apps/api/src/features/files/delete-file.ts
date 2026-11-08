import { Effect } from 'effect'
import { deleteFile as operation, type DeleteFileHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userFiles } from '../../runtime/user-resources'

export const deleteFile: DeleteFileHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		yield* respond(operation, userFiles(ctx.env, ctx.userId).remove(input.params.key))
		return { status: 204, body: undefined }
	})

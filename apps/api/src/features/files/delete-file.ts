import { Effect } from 'effect'
import { deleteFile as operation, type DeleteFileHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { FileStore } from './service'
import { userFileLayer } from '../../runtime/user-layers'

export const deleteFile: DeleteFileHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		yield* respond(
			operation,
			Effect.flatMap(FileStore, (s) => s.remove(input.params.key)).pipe(
				Effect.provide(userFileLayer(ctx.env, ctx.userId)),
			),
		)
		return { status: 204, body: undefined }
	})

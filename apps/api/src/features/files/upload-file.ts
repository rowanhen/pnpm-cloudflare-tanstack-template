import { Effect } from 'effect'
import { uploadFile as operation, type UploadFileHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userFiles } from '../../runtime/user-resources'

export const uploadFile: UploadFileHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			userFiles(ctx.env, ctx.userId).put(
				input.params.key,
				input.body,
				ctx.request.headers.get('content-type') ?? 'application/octet-stream',
			),
		)
		return { status: 201, body: { file: { key: value.key, size: value.size, etag: value.etag } } }
	})

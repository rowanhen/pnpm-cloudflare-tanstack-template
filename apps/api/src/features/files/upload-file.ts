import { Effect } from 'effect'
import { uploadFile as operation, type UploadFileHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { FileStore } from './service'
import { userFileLayer } from '../../runtime/user-layers'

export const uploadFile: UploadFileHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(FileStore, (s) =>
				s.put(
					input.params.key,
					input.body,
					ctx.request.headers.get('content-type') ?? 'application/octet-stream',
				),
			).pipe(Effect.provide(userFileLayer(ctx.env, ctx.userId))),
		)
		return { status: 201, body: { file: { key: value.key, size: value.size, etag: value.etag } } }
	})

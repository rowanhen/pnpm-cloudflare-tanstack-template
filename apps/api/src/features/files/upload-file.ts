import { Effect } from 'effect'
import { uploadFile as operation, type UploadFileHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'

export const uploadFile: UploadFileHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const object = yield* attempt(operation, async () =>
			context.env.FILES.put(
				`${context.userId}/${input.params.key}`,
				await input.body.arrayBuffer(),
				{
					httpMetadata: {
						contentType: context.request.headers.get('content-type') ?? 'application/octet-stream',
					},
				},
			),
		)
		return {
			status: 201,
			body: { file: { key: input.params.key, size: object.size, etag: object.httpEtag } },
		}
	})

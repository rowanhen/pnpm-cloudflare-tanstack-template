import { Effect } from 'effect'
import { listFiles as operation, type ListFilesHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'

export const listFiles: ListFilesHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const result = yield* attempt(operation, () =>
			context.env.FILES.list({
				limit: input.query.limit,
				prefix: `${context.userId}/`,
				cursor: input.query.cursor,
			}),
		)
		return {
			status: 200,
			body: {
				files: result.objects.map((object) => ({
					key: object.key.slice(context.userId.length + 1),
					size: object.size,
					etag: object.httpEtag,
					uploaded: object.uploaded.toISOString(),
				})),
				cursor: result.truncated ? result.cursor : null,
			},
		}
	})

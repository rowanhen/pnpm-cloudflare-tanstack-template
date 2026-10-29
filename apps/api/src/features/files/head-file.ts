import { Effect } from 'effect'
import { headFile as operation, type HeadFileHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { HttpError } from '../../http'
export const headFile: HeadFileHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const object = yield* attempt(operation, async () => {
			const result = await context.env.FILES.head(`${context.userId}/${input.params.key}`)
			if (!result) throw new HttpError(404, 'File not found')
			return result
		})
		const headers = new Headers()
		object.writeHttpMetadata(headers)
		headers.set('ETag', object.httpEtag)
		headers.set('Content-Length', String(object.size))
		headers.set('Content-Disposition', `attachment; filename="${input.params.key}"`)
		return { status: 200, body: undefined, headers: Object.fromEntries(headers) }
	})

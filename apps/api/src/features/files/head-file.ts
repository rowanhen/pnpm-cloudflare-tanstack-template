import { Effect } from 'effect'
import { headFile as operation, type HeadFileHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userFiles } from '../../runtime/user-resources'
import { fileHeaders } from './http'

export const headFile: HeadFileHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(operation, userFiles(ctx.env, ctx.userId).head(input.params.key))
		return { status: 200, body: undefined, headers: fileHeaders(value) }
	})

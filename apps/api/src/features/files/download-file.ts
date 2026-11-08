import { Effect } from 'effect'
import {
	downloadFile as operation,
	type DownloadFileHandler,
} from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userFiles } from '../../runtime/user-resources'
import { fileHeaders } from './http'

export const downloadFile: DownloadFileHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(operation, userFiles(ctx.env, ctx.userId).get(input.params.key))
		return { status: 200, body: value.body, headers: fileHeaders(value) }
	})

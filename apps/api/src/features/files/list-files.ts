import { Effect } from 'effect'
import { listFiles as operation, type ListFilesHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userFiles } from '../../runtime/user-resources'

export const listFiles: ListFilesHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(operation, userFiles(ctx.env, ctx.userId).list(input.query))
		return { status: 200, body: value }
	})

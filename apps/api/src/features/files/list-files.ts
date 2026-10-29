import { Effect } from 'effect'
import { listFiles as operation, type ListFilesHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { FileStore } from './service'
import { userFileLayer } from '../../runtime/user-layers'

export const listFiles: ListFilesHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(FileStore, (s) => s.list(input.query)).pipe(
				Effect.provide(userFileLayer(ctx.env, ctx.userId)),
			),
		)
		return { status: 200, body: value }
	})

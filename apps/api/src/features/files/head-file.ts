import { Effect } from 'effect'
import { headFile as operation, type HeadFileHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { FileStore } from './service'
import { userFileLayer } from '../../runtime/user-layers'
import { fileHeaders } from './http'

export const headFile: HeadFileHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(FileStore, (s) => s.head(input.params.key)).pipe(
				Effect.provide(userFileLayer(ctx.env, ctx.userId)),
			),
		)
		return { status: 200, body: undefined, headers: fileHeaders(value) }
	})

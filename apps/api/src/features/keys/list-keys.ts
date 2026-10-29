import { Effect } from 'effect'
import { listKeys as operation, type ListKeysHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { KeyService } from './service'
import { keyLayer } from '../../runtime/key-layers'

export const listKeys: ListKeysHandler<ApiRequest> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(KeyService, (s) => s.list).pipe(Effect.provide(keyLayer(ctx.env, ctx.userId))),
		)
		return { status: 200, body: { keys: value } }
	})

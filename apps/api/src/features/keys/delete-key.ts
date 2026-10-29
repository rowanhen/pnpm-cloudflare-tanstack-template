import { Effect } from 'effect'
import { deleteKey as operation, type DeleteKeyHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { KeyService } from './service'
import { keyLayer } from '../../runtime/key-layers'

export const deleteKey: DeleteKeyHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		yield* respond(
			operation,
			Effect.flatMap(KeyService, (s) => s.remove(input.params.id)).pipe(
				Effect.provide(keyLayer(ctx.env, ctx.userId)),
			),
		)
		return { status: 204, body: undefined }
	})

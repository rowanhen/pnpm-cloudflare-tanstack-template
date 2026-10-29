import { Effect } from 'effect'
import { createKey as operation, type CreateKeyHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { KeyService } from './service'
import { keyLayer } from '../../runtime/key-layers'

export const createKey: CreateKeyHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(
			operation,
			Effect.flatMap(KeyService, (s) => s.create(input.body)).pipe(
				Effect.provide(keyLayer(ctx.env, ctx.userId)),
			),
		)
		return { status: 201, body: { key: value } }
	})

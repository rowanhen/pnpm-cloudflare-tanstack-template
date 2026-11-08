import { Effect } from 'effect'
import { createKey as operation, type CreateKeyHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { respond } from '../../contract/service'
import { userKeys } from '../../runtime/key-resources'

export const createKey: CreateKeyHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* respond(operation, userKeys(ctx.env, ctx.userId).create(input.body))
		return { status: 201, body: { key: value } }
	})

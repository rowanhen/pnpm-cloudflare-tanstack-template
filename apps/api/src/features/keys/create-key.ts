import { Effect } from 'effect'
import { createKey as operation, type CreateKeyHandler } from '@workspace/contracts/operations'
import { ApiRequest } from '../../contract/context'
import { attempt } from '../../contract/service'
import { createKey as service } from '../../keys'
export const createKey: CreateKeyHandler<ApiRequest> = (input) =>
	Effect.gen(function* () {
		const context = yield* ApiRequest
		const body = yield* attempt(operation, () => service(context.env, context.userId, input.body))
		return { status: 201, body }
	})

import { Effect } from 'effect'
import type {
	CreateKeyHandler,
	DeleteKeyHandler,
	ListKeysHandler,
} from '@workspace/contracts/operations'
import { ApiRequest, type ApiFailure } from '../../contract/context'
import { userKeys } from '../../runtime/key-resources'

export const createKey: CreateKeyHandler<ApiRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* userKeys(ctx.env, ctx.userId).create(input.body)
		return { status: 201, body: { key: value } }
	})

export const deleteKey: DeleteKeyHandler<ApiRequest, ApiFailure> = (input) =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		yield* userKeys(ctx.env, ctx.userId).remove(input.params.id)
		return { status: 204, body: undefined }
	})

export const listKeys: ListKeysHandler<ApiRequest, ApiFailure> = () =>
	Effect.gen(function* () {
		const ctx = yield* ApiRequest
		const value = yield* userKeys(ctx.env, ctx.userId).list
		return { status: 200, body: { keys: value } }
	})

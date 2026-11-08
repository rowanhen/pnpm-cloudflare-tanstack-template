import { Effect, Clock } from 'effect'
import type { Key, KeyScope } from '@workspace/contracts'
import { CreateKeyData } from '@workspace/contracts/values'
import { Conflict, Forbidden, MissingRecord, Unauthorized } from '../../errors'
import type { StorageError } from '../../persistence'
import type { RateLimiter } from '../rate-limits/rate-limits'
import type { IdentityCrypto } from '../../identity'
import { validate } from '../../validation'
export const MAX_KEYS = 10
export type KeyRepository = {
	readonly list: Effect.Effect<readonly Key[], StorageError>
	readonly create: (
		name: string,
		scope: KeyScope,
		hash: string,
		prefix: string,
	) => Effect.Effect<string | undefined, StorageError>
	readonly remove: (id: string) => Effect.Effect<boolean, StorageError>
}
export type KeyAuthenticationRepository = {
	readonly find: (
		hash: string,
	) => Effect.Effect<{ id: string; userId: string; scope: KeyScope } | undefined, StorageError>
	readonly touch: (id: string, millis: number) => Effect.Effect<void, StorageError>
}
export type KeyOwner = { readonly userId: string }

export const makeKeys = ({
	repository,
	crypto,
	limiter,
	owner,
}: {
	repository: KeyRepository
	crypto: IdentityCrypto
	limiter: RateLimiter
	owner: KeyOwner
}) => {
	return {
		list: repository.list,
		create: (input: typeof CreateKeyData.Type) =>
			Effect.gen(function* () {
				const body = yield* validate(CreateKeyData, input)
				yield* limiter.check(`key-create:${owner.userId}`, 10)
				const name = body.name.trim()
				const token = yield* crypto.token
				const prefix = token.slice(0, 13)
				const id = yield* repository.create(name, body.scope, yield* crypto.hash(token), prefix)
				if (!id)
					return yield* new Conflict({
						message: `Delete an existing key before creating another (maximum ${MAX_KEYS})`,
					})
				return { id, name, prefix, token, scope: body.scope }
			}),
		remove: (id: string) =>
			Effect.gen(function* () {
				if (!(yield* repository.remove(id)))
					return yield* new MissingRecord({ message: 'API key not found' })
			}),
	}
}

export const makeKeyAuthentication = ({
	repository,
	crypto,
	limiter,
}: {
	repository: KeyAuthenticationRepository
	crypto: IdentityCrypto
	limiter: RateLimiter
}) => {
	return {
		authenticate: (token: string, scope: KeyScope) =>
			Effect.gen(function* () {
				if (!/^idea_[a-f0-9]{64}$/.test(token))
					return yield* new Unauthorized({ message: 'A valid API key is required' })
				const key = yield* repository.find(yield* crypto.hash(token))
				if (!key) return yield* new Unauthorized({ message: 'Invalid or deleted API key' })
				if (key.scope !== scope)
					return yield* new Forbidden({ message: `This endpoint requires ${scope}` })
				const quota = yield* limiter.check(`api-key:${key.id}`, 30)
				yield* repository.touch(key.id, yield* Clock.currentTimeMillis)
				return { userId: key.userId, keyId: key.id, quota }
			}),
	}
}

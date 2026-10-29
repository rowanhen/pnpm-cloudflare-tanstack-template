import { Clock, Effect, Layer } from 'effect'
import { CreateKeyData } from '@workspace/contracts/values'
import { Conflict, Forbidden, MissingRecord, Unauthorized } from '../../errors'
import { IdentityCrypto } from '../../identity'
import { validate } from '../../validation'
import { RateLimiter } from '../rate-limits/service'
import {
	KeyOwner,
	KeyRepository,
	KeyService,
	KeyAuthentication,
	KeyAuthenticationRepository,
	MAX_KEYS,
} from './service'
export const KeyLive = Layer.effect(
	KeyService,
	Effect.gen(function* () {
		const repository = yield* KeyRepository
		const crypto = yield* IdentityCrypto
		const limiter = yield* RateLimiter
		const owner = yield* KeyOwner
		return {
			list: repository.list,
			create: (input) =>
				Effect.gen(function* () {
					const body = yield* validate(CreateKeyData, input)
					yield* limiter.check(`key-create:${owner.userId}`, 10)
					const name = body.name.trim()
					const token = yield* crypto.token
					const prefix = token.slice(0, 13)
					const id = yield* repository.create(name, body.scope, yield* crypto.hash(token), prefix)
					if (!id)
						return yield* Effect.fail(
							new Conflict({
								message: `Delete an existing key before creating another (maximum ${MAX_KEYS})`,
							}),
						)
					return { id, name, prefix, token, scope: body.scope }
				}),
			remove: (id) =>
				Effect.gen(function* () {
					if (!(yield* repository.remove(id)))
						return yield* Effect.fail(new MissingRecord({ message: 'API key not found' }))
				}),
		}
	}),
)

export const KeyAuthenticationLive = Layer.effect(
	KeyAuthentication,
	Effect.gen(function* () {
		const repository = yield* KeyAuthenticationRepository
		const crypto = yield* IdentityCrypto
		const limiter = yield* RateLimiter
		return {
			authenticate: (token, scope) =>
				Effect.gen(function* () {
					if (!/^idea_[a-f0-9]{64}$/.test(token))
						return yield* Effect.fail(new Unauthorized({ message: 'A valid API key is required' }))
					const key = yield* repository.find(yield* crypto.hash(token))
					if (!key)
						return yield* Effect.fail(new Unauthorized({ message: 'Invalid or deleted API key' }))
					if (key.scope !== scope)
						return yield* Effect.fail(new Forbidden({ message: `This endpoint requires ${scope}` }))
					const quota = yield* limiter.check(`api-key:${key.id}`, 30)
					yield* repository.touch(key.id, yield* Clock.currentTimeMillis)
					return { userId: key.userId, keyId: key.id, quota }
				}),
		}
	}),
)

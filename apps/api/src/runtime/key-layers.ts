import { Layer } from 'effect'
import type { Env } from '../env'
import { IdentityCryptoLive } from '../identity-crypto'
import { KeyLive, KeyAuthenticationLive } from '../features/keys/live'
import { KeyOwner } from '../features/keys/service'
import { keyRepositoryLayer, keyAuthenticationRepositoryLayer } from '../features/keys/repository'
import { rateLimiterLayer } from './rate-limit-layers'
export const keyLayer = (env: Env, userId: string) =>
	KeyLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				keyRepositoryLayer(env.IDENTITY_DB, userId),
				Layer.succeed(KeyOwner, { userId }),
				rateLimiterLayer(env),
				IdentityCryptoLive,
			),
		),
	)

export const keyAuthenticationLayer = (env: Env) =>
	KeyAuthenticationLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				keyAuthenticationRepositoryLayer(env.IDENTITY_DB),
				rateLimiterLayer(env),
				IdentityCryptoLive,
			),
		),
	)

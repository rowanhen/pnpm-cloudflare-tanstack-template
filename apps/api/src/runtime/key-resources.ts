import type { Env } from '../env'
import { identityCrypto } from '../identity-crypto'
import { makeKeys, makeKeyAuthentication } from '../features/keys/keys'
import { keyRepository, keyAuthenticationRepository } from '../features/keys/repository'
import { rateLimiter } from './rate-limit-resources'
export const userKeys = (env: Env, userId: string) =>
	makeKeys({
		repository: keyRepository(env.DB, userId),
		owner: { userId },
		limiter: rateLimiter(env),
		crypto: identityCrypto,
	})
export const keyAuthentication = (env: Env) =>
	makeKeyAuthentication({
		repository: keyAuthenticationRepository(env.DB),
		limiter: rateLimiter(env),
		crypto: identityCrypto,
	})

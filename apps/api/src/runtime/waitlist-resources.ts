import type { Env } from '../env'
import { identityCrypto } from '../identity-crypto'
import { makeWaitlist } from '../features/waitlist/waitlist'
import { waitlistRepository } from '../features/waitlist/repository'
import { emails } from './email-resources'
import { rateLimiter } from './rate-limit-resources'
export const waitlist = (env: Env) => {
	const limiter = rateLimiter(env)
	return makeWaitlist({
		repository: waitlistRepository(env.DB),
		crypto: identityCrypto,
		email: emails(env, limiter),
		limiter,
	})
}

import { Effect } from 'effect'
import { WaitlistInput } from '@workspace/contracts/values'
import type { User } from '@workspace/contracts'
import type { StorageError } from '../../persistence'
import type { IdentityCrypto } from '../../identity'
import { validate } from '../../validation'
import type { EmailService } from '../emails/emails'
import type { RateLimiter } from '../rate-limits/rate-limits'
export type WaitlistRepository = {
	readonly join: (entry: {
		email: string
		name: string
		consent: true
	}) => Effect.Effect<string | undefined, StorageError>
	readonly find: (email: string) => Effect.Effect<{ created_at: string } | undefined, StorageError>
}

export const makeWaitlist = ({
	repository,
	crypto,
	email,
	limiter,
}: {
	repository: WaitlistRepository
	crypto: IdentityCrypto
	email: Pick<EmailService, 'confirm'>
	limiter: RateLimiter
}) => {
	return {
		join: (input: typeof WaitlistInput.Type, ip: string) =>
			Effect.gen(function* () {
				const body = yield* validate(WaitlistInput, input)
				const response = { message: "You're on the list. Thanks for your interest!" }
				if (body.website) return response
				const address = body.email.toLowerCase()
				yield* limiter.check(`waitlist-ip:${yield* crypto.hash(ip)}`, 10, 3600)
				yield* limiter.check(`waitlist-email:${yield* crypto.hash(address)}`, 3, 3600)
				const id = yield* repository.join({
					email: address,
					name: body.name.trim(),
					consent: body.consent,
				})
				if (id) yield* email.confirm(address, id)
				return response
			}),
		status: (user: User) =>
			Effect.gen(function* () {
				const entry = user.emailVerified ? yield* repository.find(user.email) : undefined
				return entry ? { joined: true as const, entry } : { joined: false as const, entry: null }
			}),
	}
}

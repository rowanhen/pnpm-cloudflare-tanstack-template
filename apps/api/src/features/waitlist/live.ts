import { Effect, Layer } from 'effect'
import { WaitlistInput } from '@workspace/contracts/values'
import { IdentityCrypto } from '../../identity'
import { validate } from '../../validation'
import { EmailService } from '../emails/service'
import { RateLimiter } from '../rate-limits/service'
import { WaitlistService, WaitlistRepository } from './service'
export const WaitlistLive = Layer.effect(
	WaitlistService,
	Effect.gen(function* () {
		const repository = yield* WaitlistRepository
		const crypto = yield* IdentityCrypto
		const email = yield* EmailService
		const limiter = yield* RateLimiter
		return {
			join: (input, ip) =>
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
			status: (user) =>
				Effect.gen(function* () {
					const entry = user.emailVerified ? yield* repository.find(user.email) : undefined
					return entry ? { joined: true as const, entry } : { joined: false as const, entry: null }
				}),
		}
	}),
)

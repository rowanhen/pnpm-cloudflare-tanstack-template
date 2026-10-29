import { Clock, Effect, Layer } from 'effect'
import { SendTestEmailData, WaitlistInput } from '@workspace/contracts/values'
import { Conflict, Forbidden, Unavailable } from '../../errors'
import { preserveFatal } from '../../effect-errors'
import { validate } from '../../validation'
import { RateLimiter } from '../rate-limits/service'
import type { Mail } from './domain'
import { EmailProvider, EmailRepository, EmailService } from './service'
export const EmailLive = Layer.effect(
	EmailService,
	Effect.gen(function* () {
		const repository = yield* EmailRepository
		const provider = yield* EmailProvider
		const limiter = yield* RateLimiter
		const send = (mail: Mail) =>
			Effect.gen(function* () {
				const claim = yield* repository.reserve(mail)
				if (claim.kind === 'existing') {
					if (claim.state.status === 'accepted')
						return {
							id: claim.state.id,
							status: 'accepted' as const,
							messageId: claim.state.message_id,
						}
					return yield* Effect.fail(
						new Conflict({
							message: 'This email was already attempted. Check its status before sending another.',
						}),
					)
				}
				const messageId = yield* provider.send(mail.to, mail.template).pipe(
					preserveFatal,
					Effect.catchTag('ProviderFailure', (error) =>
						Effect.gen(function* () {
							yield* repository.settle(
								claim.id,
								{ status: 'failed', code: 'SEND_FAILED' },
								yield* Clock.currentTimeMillis,
							)
							return yield* Effect.fail(error)
						}),
					),
				)
				yield* repository.settle(
					claim.id,
					{ status: 'accepted', messageId },
					yield* Clock.currentTimeMillis,
				)
				return { id: claim.id, status: 'accepted' as const, messageId }
			}).pipe(Effect.uninterruptible) // Native email delivery cannot be aborted; finish claim settlement.
		return {
			status: (userId) =>
				repository
					.list(userId)
					.pipe(Effect.map((emails) => ({ enabled: provider.enabled, emails }))),
			confirm: (email, entryId) =>
				Effect.gen(function* () {
					if (!provider.enabled) return
					const to = yield* validate(WaitlistInput.fields.email, email)
					yield* send({ to, template: 'waitlist', dedupeKey: `waitlist:${entryId}` }).pipe(
						preserveFatal,
						Effect.catchTag('ProviderFailure', () => Effect.void),
						Effect.catchTag('Unavailable', () => Effect.void),
						Effect.catchTag('Conflict', () => Effect.void),
					)
				}),
			test: (user, requestId) =>
				Effect.gen(function* () {
					if (!user.emailVerified)
						return yield* Effect.fail(
							new Forbidden({ message: 'Verify your email before sending a test' }),
						)
					if (!provider.enabled)
						return yield* Effect.fail(new Unavailable({ message: 'Email is not configured' }))
					yield* validate(SendTestEmailData, { requestId })
					const to = yield* validate(WaitlistInput.fields.email, user.email)
					yield* limiter.check(`email-test:${user.id}`, 3, 3600)
					return yield* send({
						to,
						userId: user.id,
						template: 'test',
						dedupeKey: `test:${user.id}:${requestId}`,
					})
				}),
		}
	}),
)

import { Effect, Clock } from 'effect'
import { type EmailStatusData, SendTestEmailData, WaitlistInput } from '@workspace/contracts/values'
import type { User } from '@workspace/contracts'
import type { StorageError } from '../../persistence'
import { type ProviderFailure, Unavailable, Conflict, Forbidden } from '../../errors'
import type { Mail, DeliveryState, Settlement } from './domain'
import { preserveFatal } from '../../effect-errors'
import { validate } from '../../validation'
import type { RateLimiter } from '../rate-limits/rate-limits'
export type EmailRepository = {
	readonly reserve: (
		mail: Mail,
	) => Effect.Effect<
		{ kind: 'fresh'; id: string } | { kind: 'existing'; state: DeliveryState },
		StorageError
	>
	readonly settle: (
		id: string,
		settlement: Settlement,
		millis: number,
	) => Effect.Effect<void, StorageError>
	readonly list: (userId: string) => Effect.Effect<typeof EmailStatusData.Type, StorageError>
}
export type EmailProvider = {
	readonly enabled: boolean
	readonly send: (
		to: string,
		template: Mail['template'],
	) => Effect.Effect<string, ProviderFailure | Unavailable>
}
export type EmailService = ReturnType<typeof makeEmails>

export const makeEmails = ({
	repository,
	provider,
	limiter,
}: {
	repository: EmailRepository
	provider: EmailProvider
	limiter: RateLimiter
}) => {
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
				return yield* new Conflict({
					message: 'This email was already attempted. Check its status before sending another.',
				})
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
						return yield* error
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
		status: (userId: string) =>
			repository.list(userId).pipe(Effect.map((emails) => ({ enabled: provider.enabled, emails }))),
		confirm: (email: string, entryId: string) =>
			Effect.gen(function* () {
				if (!provider.enabled) return
				const to = yield* validate(WaitlistInput.fields.email, email)
				yield* send({ to, template: 'waitlist', dedupeKey: `waitlist:${entryId}` }).pipe(
					preserveFatal,
					Effect.catchTags({
						ProviderFailure: () => Effect.void,
						Unavailable: () => Effect.void,
						Conflict: () => Effect.void,
					}),
				)
			}),
		test: (user: User, requestId: string) =>
			Effect.gen(function* () {
				if (!user.emailVerified)
					return yield* new Forbidden({ message: 'Verify your email before sending a test' })
				if (!provider.enabled) return yield* new Unavailable({ message: 'Email is not configured' })
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
}

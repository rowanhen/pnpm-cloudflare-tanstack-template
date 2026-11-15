import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { Cause, Effect, Exit, Result, Schema } from 'effect'
import { makeEmails, type EmailRepository, type EmailProvider } from '../emails.ts'
import { DeliveryState } from '../domain.ts'
import { ProviderFailure, Conflict } from '../../../errors.ts'
import { StorageError } from '../../../persistence.ts'

const limiter: Parameters<typeof makeEmails>[0]['limiter'] = {
	check: (_key, limit) => Effect.succeed({ limit, remaining: limit - 1, reset: 120 }),
}
const user = {
	id: 'owner',
	name: 'Owner',
	email: 'owner@example.test',
	emailVerified: true,
	image: null,
}
const requestId = '00000000-0000-4000-8000-000000000001'

function mailFixture(
	overrides: Partial<EmailRepository> = {},
	send: EmailProvider['send'] = () => Effect.succeed('message'),
) {
	const settlements: unknown[] = []
	const repository: EmailRepository = {
		reserve: () => Effect.succeed({ kind: 'fresh', id: 'claim' }),
		settle: (_id, value) =>
			Effect.sync(() => {
				settlements.push(value)
			}),
		list: () => Effect.succeed([]),
		...overrides,
	}
	const service = makeEmails({ limiter, repository, provider: { enabled: true, send } })
	return { service, settlements }
}

describe('emails', () => {
	test('when a stored email receipt contradicts its status, decoding rejects it', () => {
		const decode = Schema.decodeUnknownSync(DeliveryState)
		for (const value of [
			{ id: 'x', status: 'accepted', message_id: null, error_code: null },
			{ id: 'x', status: 'failed', message_id: 'message', error_code: 'failed' },
			{ id: 'x', status: 'sending', message_id: null, error_code: 'failed' },
		])
			assert.throws(() => decode(value))
		assert.equal(
			decode({ id: 'x', status: 'accepted', message_id: 'message', error_code: null }).status,
			'accepted',
		)
	})

	test('when an email attempt already exists, replay does not resend it', async () => {
		let attempts = 0
		for (const state of [
			{ id: 'claim', status: 'accepted', message_id: 'saved', error_code: null },
			{ id: 'claim', status: 'sending', message_id: null, error_code: null },
			{ id: 'claim', status: 'failed', message_id: null, error_code: 'SEND_FAILED' },
		] as const) {
			const { service } = mailFixture(
				{ reserve: () => Effect.succeed({ kind: 'existing', state }) },
				() =>
					Effect.sync(() => {
						attempts++
						return 'new'
					}),
			)
			const result = await Effect.runPromise(service.test(user, requestId).pipe(Effect.result))
			if (state.status === 'accepted') {
				assert.ok(Result.isSuccess(result))
			} else {
				assert.ok(Result.isFailure(result))
				if (Result.isFailure(result)) assert.ok(result.failure instanceof Conflict)
			}
		}
		assert.equal(attempts, 0)
	})

	test('when optional confirmation fails, delivery errors recover and storage errors propagate', async () => {
		const providerFailure = new ProviderFailure({
			message: 'unavailable',
			cause: new Error('provider'),
		})
		const fixture = mailFixture({}, () => Effect.fail(providerFailure))
		await Effect.runPromise(fixture.service.confirm(user.email, 'entry'))
		assert.deepEqual(fixture.settlements, [{ status: 'failed', code: 'SEND_FAILED' }])
		const storage = new StorageError({ cause: new Error('database') })
		for (const overrides of [
			{ reserve: () => Effect.fail(storage) },
			{ settle: () => Effect.fail(storage) },
		]) {
			const { service } = mailFixture(overrides, () => Effect.fail(providerFailure))
			const error = await Effect.runPromise(service.confirm(user.email, 'entry').pipe(Effect.flip))
			assert.equal(error, storage)
		}
		const { service, settlements } = mailFixture({}, () =>
			Effect.failCause(
				Cause.fromReasons([
					Cause.makeFailReason(providerFailure),
					Cause.makeDieReason(new Error('defect')),
				]),
			),
		)
		const exit = await Effect.runPromiseExit(service.confirm(user.email, 'entry'))
		assert.ok(Exit.isFailure(exit) && Cause.hasDies(exit.cause))
		assert.deepEqual(settlements, [])
	})

	test('when settlement fails after provider acceptance, the attempt remains ambiguous', async () => {
		let reserved = false
		let sends = 0
		const storage = new StorageError({ cause: 'settlement unavailable' })
		const { service } = mailFixture(
			{
				reserve: () =>
					Effect.sync(() => {
						if (reserved)
							return {
								kind: 'existing' as const,
								state: {
									id: 'claim',
									status: 'sending' as const,
									message_id: null,
									error_code: null,
								},
							}
						reserved = true
						return { kind: 'fresh' as const, id: 'claim' }
					}),
				settle: () => Effect.fail(storage),
			},
			() =>
				Effect.sync(() => {
					sends++
					return 'accepted-by-provider'
				}),
		)
		assert.equal(await Effect.runPromise(service.test(user, requestId).pipe(Effect.flip)), storage)
		const retry = await Effect.runPromise(service.test(user, requestId).pipe(Effect.flip))
		assert.ok(retry instanceof Conflict)
		assert.equal(sends, 1)
	})
})

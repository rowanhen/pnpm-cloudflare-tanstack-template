import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Cause, Effect, Exit, Result, Schema } from 'effect'
import * as TestClock from 'effect/testing/TestClock'
import {
	makeEmails,
	type EmailRepository,
	type EmailProvider,
} from '../../apps/api/src/features/emails/emails.ts'
import { DeliveryState } from '../../apps/api/src/features/emails/domain.ts'
import {
	makeRateLimiter,
	type RateLimiter,
} from '../../apps/api/src/features/rate-limits/rate-limits.ts'
import { makeBilling } from '../../apps/api/src/features/billing/billing.ts'
import { makeSummary } from '../../apps/api/src/features/metered/metered.ts'
import { SummaryResult } from '../../apps/api/src/features/metered/domain.ts'
import { makeStorefront } from '../../apps/api/src/features/storefront/storefront.ts'
import type { PaymentSession } from '../../apps/api/src/features/payments/payments.ts'
import { makeWaitlist } from '../../apps/api/src/features/waitlist/waitlist.ts'
import { makeKeyAuthentication } from '../../apps/api/src/features/keys/keys.ts'
import type { IdentityCrypto } from '../../apps/api/src/identity.ts'
import {
	ProviderFailure,
	Conflict,
	InsufficientCredits,
	RateLimited,
	Unavailable,
	Unauthorized,
	Forbidden,
} from '../../apps/api/src/errors.ts'
import { StorageError, decodeStored } from '../../apps/api/src/persistence.ts'

const limiter = {
	check: (_key, limit) => Effect.succeed({ limit, remaining: limit - 1, reset: 120 }),
} satisfies RateLimiter
const identity = {
	hash: (value) => Effect.succeed(`hash:${value}`),
	token: Effect.succeed('token'),
} satisfies IdentityCrypto
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

test('email states reject contradictory persisted receipts', () => {
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

test('email replay never resends accepted or ambiguous attempts', async () => {
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

test('optional confirmations recover delivery failures but propagate storage failures and defects', async () => {
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

test('rate limits use the supplied clock and keep fixed-window retry semantics', async () => {
	const calls: unknown[] = []
	const service = makeRateLimiter({
		repository: {
			acquire: (key, limit, window) =>
				Effect.sync(() => {
					calls.push({ key, limit, window })
					return calls.length === 1 ? 1 : undefined
				}),
		},
	})
	const result = await Effect.runPromise(
		Effect.gen(function* () {
			yield* TestClock.setTime(61_000)
			const quota = yield* service.check('owner', 1)
			const failure = yield* service.check('owner', 1).pipe(Effect.flip)
			return { quota, failure }
		}).pipe(Effect.provide(TestClock.layer())),
	)
	assert.deepEqual(result.quota, { limit: 1, remaining: 0, reset: 120 })
	assert.ok(result.failure instanceof RateLimited)
	assert.equal(result.failure.retryAfter, 59)
	assert.deepEqual(calls, [
		{ key: 'owner', limit: 1, window: 60 },
		{ key: 'owner', limit: 1, window: 60 },
	])
})

test('billing distinguishes insufficient funds, conflicting input and idempotent replay', async () => {
	for (const receipt of [
		undefined,
		{ id: 'saved', operation: 'other', input_hash: 'hash', credits: 1, response: '{}' },
		{ id: 'saved', operation: 'summary', input_hash: 'hash', credits: 1, response: '{}' },
	]) {
		const service = makeBilling({
			repository: {
				status: Effect.succeed({ balance: 3, activity: [], packCredits: 1000, summaryCost: 1 }),
				reserve: () => Effect.succeed({ receipt, balance: 3, attemptId: 'new' }),
			},
		})
		const result = await Effect.runPromise(
			service
				.charge({
					keyId: 'key',
					idempotencyKey: requestId,
					operation: 'summary',
					inputHash: 'hash',
					cost: 1,
					result: '{}',
				})
				.pipe(Effect.result),
		)
		if (!receipt) {
			assert.ok(Result.isFailure(result))
			if (Result.isFailure(result)) assert.ok(result.failure instanceof InsufficientCredits)
		} else if (receipt.operation !== 'summary') {
			assert.ok(Result.isFailure(result))
			if (Result.isFailure(result)) assert.ok(result.failure instanceof Conflict)
		} else {
			assert.ok(Result.isSuccess(result))
			if (Result.isSuccess(result)) assert.equal(result.success.charged, 0)
		}
	}
})

test('invalid summary snapshots never call the billing capability', async () => {
	let charges = 0
	const service = makeSummary({
		crypto: identity,
		repository: {
			snapshot: () => Effect.succeed({ total: 1, completed: 2 }),
			decodeReplay: () => Effect.die('must not replay'),
		},
		billing: {
			charge: () =>
				Effect.sync(() => {
					charges++
					return {
						response: '{}',
						requestId: 'receipt',
						charged: 1,
						balance: 2,
						replayed: false,
					}
				}),
		},
	})
	const exit = await Effect.runPromiseExit(service.create('key', requestId, { status: 'all' }))
	assert.ok(Exit.isFailure(exit))
	assert.equal(charges, 0)
	const corrupt = await Effect.runPromise(
		decodeStored(SummaryResult, {
			summary: { total: 2, completed: 1, open: 2 },
			status: 'all',
		}).pipe(Effect.flip),
	)
	assert.ok(corrupt instanceof StorageError)
})

test('storefront rejects missing provider amounts instead of inventing a paid amount', async () => {
	const session: PaymentSession = {
		id: 'cs_test_one',
		livemode: false,
		mode: 'payment',
		status: 'complete',
		payment_status: 'paid',
		client_reference_id: null,
		client_secret: null,
		amount_total: null,
		currency: null,
		metadata: { example: 'storefront', guest_token_hash: `hash:${requestId}` },
	}
	const service = makeStorefront({
		limiter,
		crypto: identity,
		settings: {
			enabled: true,
			purchasePrice: 'one',
			subscriptionPrice: 'two',
			publishableKey: 'pk_test',
		},
		gateway: {
			price: () => Effect.die('unused'),
			create: () => Effect.die('unused'),
			verify: () => Effect.die('unused'),
			session: () => Effect.succeed(session),
		},
	})
	const error = await Effect.runPromise(
		service.check('ip', { sessionId: session.id, token: requestId }).pipe(Effect.flip),
	)
	assert.ok(error instanceof Unavailable)
})

test('waitlist preflight and verification avoid side effects and keep limits sequential', async () => {
	const calls: string[] = []
	const service = makeWaitlist({
		crypto: identity,
		repository: {
			join: () =>
				Effect.sync(() => {
					calls.push('insert')
					return 'entry'
				}),
			find: () =>
				Effect.sync(() => {
					calls.push('find')
					return { created_at: 'now' }
				}),
		},
		email: {
			confirm: () =>
				Effect.sync(() => {
					calls.push('confirm')
				}),
		},
		limiter: {
			check: (key, limit) =>
				Effect.sync(() => {
					calls.push(key)
					return { limit, remaining: 1, reset: 1 }
				}),
		},
	})
	await Effect.runPromise(
		service.join({ email: 'a@example.test', name: '', consent: true, website: 'bot' }, 'ip'),
	)
	assert.deepEqual(calls, [])
	const status = await Effect.runPromise(service.status({ ...user, emailVerified: false }))
	assert.deepEqual(status, { joined: false, entry: null })
	await Effect.runPromise(
		service.join({ email: 'A@example.test', name: '', consent: true, website: '' }, 'ip'),
	)
	assert.deepEqual(calls, [
		'waitlist-ip:hash:ip',
		'waitlist-email:hash:a@example.test',
		'insert',
		'confirm',
	])
})

test('key authentication validates scope and records usage without an owner context', async () => {
	let lookups = 0
	const touches: unknown[] = []
	const service = makeKeyAuthentication({
		crypto: identity,
		limiter,
		repository: {
			find: () =>
				Effect.sync(() => {
					lookups++
					return { id: 'key', userId: 'owner', scope: 'summary:read' as const }
				}),
			touch: (id, millis) =>
				Effect.sync(() => {
					touches.push({ id, millis })
				}),
		},
	})
	const token = `idea_${'a'.repeat(64)}`
	await Effect.runPromise(
		Effect.gen(function* () {
			yield* TestClock.setTime(12_345)
			const auth = service
			assert.ok(
				(yield* auth.authenticate('invalid', 'summary:read').pipe(Effect.flip)) instanceof
					Unauthorized,
			)
			assert.equal(lookups, 0)
			assert.ok(
				(yield* auth.authenticate(token, 'todos:read').pipe(Effect.flip)) instanceof Forbidden,
			)
			assert.deepEqual(touches, [])
			assert.deepEqual(yield* auth.authenticate(token, 'summary:read'), {
				userId: 'owner',
				keyId: 'key',
				quota: { limit: 30, remaining: 29, reset: 120 },
			})
		}).pipe(Effect.provide(TestClock.layer())),
	)
	assert.deepEqual(touches, [{ id: 'key', millis: 12_345 }])
})

test('a provider acceptance followed by a failed settlement remains ambiguous and is never resent', async () => {
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

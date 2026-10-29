import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Cause, Effect, Exit, Layer, Result, Schema } from 'effect'
import * as TestClock from 'effect/testing/TestClock'
import { EmailLive } from '../../apps/api/src/features/emails/live.ts'
import {
	EmailProvider,
	EmailRepository,
	EmailService,
} from '../../apps/api/src/features/emails/service.ts'
import { DeliveryState } from '../../apps/api/src/features/emails/domain.ts'
import {
	RateLimiter,
	RateLimitRepository,
} from '../../apps/api/src/features/rate-limits/service.ts'
import { RateLimiterLive } from '../../apps/api/src/features/rate-limits/live.ts'
import { BillingLedger, BillingRepository } from '../../apps/api/src/features/billing/service.ts'
import { BillingLive } from '../../apps/api/src/features/billing/live.ts'
import { SummaryRepository, SummaryService } from '../../apps/api/src/features/metered/service.ts'
import { SummaryLive } from '../../apps/api/src/features/metered/live.ts'
import { SummaryResult } from '../../apps/api/src/features/metered/domain.ts'
import { StorefrontLive } from '../../apps/api/src/features/storefront/live.ts'
import {
	StorefrontService,
	StorefrontSettings,
} from '../../apps/api/src/features/storefront/service.ts'
import {
	PaymentGateway,
	type PaymentSession,
} from '../../apps/api/src/features/payments/service.ts'
import { WaitlistLive } from '../../apps/api/src/features/waitlist/live.ts'
import {
	WaitlistRepository,
	WaitlistService,
} from '../../apps/api/src/features/waitlist/service.ts'
import { KeyAuthenticationLive } from '../../apps/api/src/features/keys/live.ts'
import {
	KeyAuthentication,
	KeyAuthenticationRepository,
} from '../../apps/api/src/features/keys/service.ts'
import { IdentityCrypto } from '../../apps/api/src/identity.ts'
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

const limiter = Layer.succeed(RateLimiter, {
	check: (_key, limit) => Effect.succeed({ limit, remaining: limit - 1, reset: 120 }),
})
const identity = Layer.succeed(IdentityCrypto, {
	hash: (value) => Effect.succeed(`hash:${value}`),
	token: Effect.succeed('token'),
})
const user = {
	id: 'owner',
	name: 'Owner',
	email: 'owner@example.test',
	emailVerified: true,
	image: null,
}
const requestId = '00000000-0000-4000-8000-000000000001'

function mailFixture(
	overrides: Partial<typeof EmailRepository.Service> = {},
	send: typeof EmailProvider.Service.send = () => Effect.succeed('message'),
) {
	const settlements: unknown[] = []
	const repository: typeof EmailRepository.Service = {
		reserve: () => Effect.succeed({ kind: 'fresh', id: 'claim' }),
		settle: (_id, value) =>
			Effect.sync(() => {
				settlements.push(value)
			}),
		list: () => Effect.succeed([]),
		...overrides,
	}
	const layer = EmailLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				limiter,
				Layer.succeed(EmailRepository, repository),
				Layer.succeed(EmailProvider, { enabled: true, send }),
			),
		),
	)
	return { layer, settlements }
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
	] as const) {
		const { layer } = mailFixture(
			{ reserve: () => Effect.succeed({ kind: 'existing', state }) },
			() =>
				Effect.sync(() => {
					attempts++
					return 'new'
				}),
		)
		const result = await Effect.runPromise(
			Effect.flatMap(EmailService, (s) => s.test(user, requestId)).pipe(
				Effect.provide(layer),
				Effect.result,
			),
		)
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
	await Effect.runPromise(
		Effect.flatMap(EmailService, (s) => s.confirm(user.email, 'entry')).pipe(
			Effect.provide(fixture.layer),
		),
	)
	assert.deepEqual(fixture.settlements, [{ status: 'failed', code: 'SEND_FAILED' }])
	const storage = new StorageError({ cause: new Error('database') })
	for (const overrides of [
		{ reserve: () => Effect.fail(storage) },
		{ settle: () => Effect.fail(storage) },
	]) {
		const { layer } = mailFixture(overrides, () => Effect.fail(providerFailure))
		const error = await Effect.runPromise(
			Effect.flatMap(EmailService, (s) => s.confirm(user.email, 'entry')).pipe(
				Effect.provide(layer),
				Effect.flip,
			),
		)
		assert.equal(error, storage)
	}
	const { layer, settlements } = mailFixture({}, () =>
		Effect.failCause(
			Cause.fromReasons([
				Cause.makeFailReason(providerFailure),
				Cause.makeDieReason(new Error('defect')),
			]),
		),
	)
	const exit = await Effect.runPromiseExit(
		Effect.flatMap(EmailService, (s) => s.confirm(user.email, 'entry')).pipe(Effect.provide(layer)),
	)
	assert.ok(Exit.isFailure(exit) && Cause.hasDies(exit.cause))
	assert.deepEqual(settlements, [])
})

test('rate limits use the supplied clock and keep fixed-window retry semantics', async () => {
	const calls: unknown[] = []
	const layer = RateLimiterLive.pipe(
		Layer.provide(
			Layer.succeed(RateLimitRepository, {
				acquire: (key, limit, window) =>
					Effect.sync(() => {
						calls.push({ key, limit, window })
						return calls.length === 1 ? 1 : undefined
					}),
			}),
		),
	)
	const result = await Effect.runPromise(
		Effect.gen(function* () {
			yield* TestClock.setTime(61_000)
			const service = yield* RateLimiter
			const quota = yield* service.check('owner', 1)
			const failure = yield* service.check('owner', 1).pipe(Effect.flip)
			return { quota, failure }
		}).pipe(Effect.provide(layer), Effect.provide(TestClock.layer())),
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
		const layer = BillingLive.pipe(
			Layer.provide(
				Layer.succeed(BillingRepository, {
					status: Effect.succeed({ balance: 3, activity: [], packCredits: 1000, summaryCost: 1 }),
					reserve: () => Effect.succeed({ receipt, balance: 3, attemptId: 'new' }),
				}),
			),
		)
		const result = await Effect.runPromise(
			Effect.flatMap(BillingLedger, (s) =>
				s.charge({
					keyId: 'key',
					idempotencyKey: requestId,
					operation: 'summary',
					inputHash: 'hash',
					cost: 1,
					result: '{}',
				}),
			).pipe(Effect.provide(layer), Effect.result),
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
	const layer = SummaryLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				identity,
				Layer.succeed(SummaryRepository, {
					snapshot: () => Effect.succeed({ total: 1, completed: 2 }),
					decodeReplay: () => Effect.die('must not replay'),
				}),
				Layer.succeed(BillingLedger, {
					status: Effect.die('unused'),
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
				}),
			),
		),
	)
	const exit = await Effect.runPromiseExit(
		Effect.flatMap(SummaryService, (s) => s.create('key', requestId, { status: 'all' })).pipe(
			Effect.provide(layer),
		),
	)
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
	const layer = StorefrontLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				limiter,
				identity,
				Layer.succeed(StorefrontSettings, {
					enabled: true,
					purchasePrice: 'one',
					subscriptionPrice: 'two',
					publishableKey: 'pk_test',
				}),
				Layer.succeed(PaymentGateway, {
					price: () => Effect.die('unused'),
					create: () => Effect.die('unused'),
					verify: () => Effect.die('unused'),
					session: () => Effect.succeed(session),
				}),
			),
		),
	)
	const error = await Effect.runPromise(
		Effect.flatMap(StorefrontService, (s) =>
			s.check('ip', { sessionId: session.id, token: requestId }),
		).pipe(Effect.provide(layer), Effect.flip),
	)
	assert.ok(error instanceof Unavailable)
})

test('waitlist preflight and verification avoid side effects and keep limits sequential', async () => {
	const calls: string[] = []
	const layer = WaitlistLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				identity,
				Layer.succeed(WaitlistRepository, {
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
				}),
				Layer.succeed(EmailService, {
					confirm: () =>
						Effect.sync(() => {
							calls.push('confirm')
						}),
					test: () => Effect.die('unused'),
					status: () => Effect.die('unused'),
				}),
				Layer.succeed(RateLimiter, {
					check: (key, limit) =>
						Effect.sync(() => {
							calls.push(key)
							return { limit, remaining: 1, reset: 1 }
						}),
				}),
			),
		),
	)
	await Effect.runPromise(
		Effect.flatMap(WaitlistService, (s) =>
			s.join({ email: 'a@example.test', name: '', consent: true, website: 'bot' }, 'ip'),
		).pipe(Effect.provide(layer)),
	)
	assert.deepEqual(calls, [])
	const status = await Effect.runPromise(
		Effect.flatMap(WaitlistService, (s) => s.status({ ...user, emailVerified: false })).pipe(
			Effect.provide(layer),
		),
	)
	assert.deepEqual(status, { joined: false, entry: null })
	await Effect.runPromise(
		Effect.flatMap(WaitlistService, (s) =>
			s.join({ email: 'A@example.test', name: '', consent: true, website: '' }, 'ip'),
		).pipe(Effect.provide(layer)),
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
	const layer = KeyAuthenticationLive.pipe(
		Layer.provide(
			Layer.mergeAll(
				identity,
				limiter,
				Layer.succeed(KeyAuthenticationRepository, {
					find: () =>
						Effect.sync(() => {
							lookups++
							return { id: 'key', userId: 'owner', scope: 'summary:read' as const }
						}),
					touch: (id, millis) =>
						Effect.sync(() => {
							touches.push({ id, millis })
						}),
				}),
			),
		),
	)
	const token = `idea_${'a'.repeat(64)}`
	await Effect.runPromise(
		Effect.gen(function* () {
			yield* TestClock.setTime(12_345)
			const auth = yield* KeyAuthentication
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
		}).pipe(Effect.provide(layer), Effect.provide(TestClock.layer())),
	)
	assert.deepEqual(touches, [{ id: 'key', millis: 12_345 }])
})

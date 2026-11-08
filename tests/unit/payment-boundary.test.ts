import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Cause, Effect, Exit } from 'effect'
import { stripeGateway } from '../../apps/api/src/features/payments/stripe.ts'
import { ProviderFailure } from '../../apps/api/src/errors.ts'

const gateway = stripeGateway({ secretKey: 'sk_test_fixture', origin: 'http://localhost' })
const session = gateway.session('cs_test_example')

test('Stripe network failures stay typed and are not automatically retried', async (t) => {
	let attempts = 0
	t.mock.method(globalThis, 'fetch', async () => {
		attempts++
		throw new Error('network')
	})
	const failure = await Effect.runPromise(session.pipe(Effect.flip))
	assert.ok(failure instanceof ProviderFailure)
	assert.equal(attempts, 1)
})

test('Stripe adapter forwards Effect cancellation to its fetch', async (t) => {
	let start: (() => void) | undefined
	const started = new Promise<void>((resolve) => {
		start = resolve
	})
	let signal: AbortSignal | null | undefined
	t.mock.method(globalThis, 'fetch', (_input: unknown, init?: RequestInit) => {
		signal = init?.signal
		assert.ok(signal)
		assert.ok(start)
		start()
		return new Promise<Response>((_resolve, reject) =>
			signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
		)
	})
	const controller = new AbortController()
	const result = Effect.runPromiseExit(session, { signal: controller.signal })
	await started
	controller.abort()
	const exit = await result
	assert.ok(signal?.aborted)
	assert.ok(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause))
})

test('invalid Stripe payloads are rejected at the provider boundary', async (t) => {
	t.mock.method(globalThis, 'fetch', async () =>
		Response.json({ id: 'cs_test_example', status: 'complete' }),
	)
	const failure = await Effect.runPromise(session.pipe(Effect.flip))
	assert.ok(failure instanceof ProviderFailure)
})

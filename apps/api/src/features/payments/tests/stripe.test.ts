import assert from 'node:assert/strict'
import { describe, test, vi } from 'vitest'
import { Cause, Effect, Exit } from 'effect'
import { stripeGateway } from '../stripe.ts'
import { ProviderFailure } from '../../../errors.ts'

const gateway = stripeGateway({ secretKey: 'sk_test_fixture', origin: 'http://localhost' })
const session = gateway.session('cs_test_example')

describe('Stripe boundary', () => {
	test('when Stripe requests fail, errors stay typed without automatic retries', async () => {
		let attempts = 0
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
			attempts++
			throw new Error('network')
		})
		const failure = await Effect.runPromise(session.pipe(Effect.flip))
		assert.ok(failure instanceof ProviderFailure)
		assert.equal(attempts, 1)
	})

	test('when an Effect is cancelled, Stripe fetch receives the abort signal', async () => {
		let start: (() => void) | undefined
		const started = new Promise<void>((resolve) => {
			start = resolve
		})
		let signal: AbortSignal | null | undefined
		vi.spyOn(globalThis, 'fetch').mockImplementation((_input: unknown, init?: RequestInit) => {
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

	test('when Stripe payloads are invalid, the provider boundary rejects them', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
			Response.json({ id: 'cs_test_example', status: 'complete' }),
		)
		const failure = await Effect.runPromise(session.pipe(Effect.flip))
		assert.ok(failure instanceof ProviderFailure)
	})
})

import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { paymentPolling } from '../payment-polling.ts'

describe('payment polling', () => {
	test('when payment polling reaches its time limit, it stops by elapsed time', () => {
		const poll = paymentPolling()
		assert.equal(poll('session', false, 0), false)
		assert.equal(poll('session', true, 10_000), 2500)
		for (let now = 10_001; now < 10_100; now++) assert.equal(poll('session', true, now), 2500)
		assert.equal(poll('session', true, 39_000), 1000)
		assert.equal(poll('session', true, 40_000), false)
		assert.equal(poll('session', true, 60_000), false)
		assert.equal(poll('session', false, 60_000), false)
		assert.equal(poll('session', true, 70_000), false)
		assert.equal(paymentPolling()('session', true, 70_000), 2500)
		assert.equal(poll('other-session', true, 70_000), 2500)
	})

	test('when payment is no longer processing, polling stops immediately', () => {
		const poll = paymentPolling()
		assert.equal(poll('session', true, 0), 2500)
		assert.equal(poll('session', false, 2500), false)
		// A late provider response never gives this session a new deadline.
		assert.equal(poll('session', true, 40_000), false)
	})
})

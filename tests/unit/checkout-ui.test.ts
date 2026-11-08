import { paymentView } from '../../apps/dashboard/src/lib/payment-view.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	checkoutReducer,
	initialCheckoutState,
	paymentPolling,
} from '../../apps/dashboard/src/lib/checkout-session.ts'
import type { StorefrontProduct } from '../../apps/dashboard/src/generated/api.schemas.ts'

const purchase: StorefrontProduct = {
	id: 'purchase',
	name: 'Purchase',
	amount: 500,
	currency: 'gbp',
	interval: null,
}
const subscription: StorefrontProduct = { ...purchase, id: 'subscription', interval: 'month' }
const session = {
	sessionId: 'cs_test_one',
	clientSecret: 'secret',
	publishableKey: 'pk_test_fixture',
}

test('checkout retries and returning to products preserve each product’s idempotency and buyer proof', () => {
	let state = checkoutReducer(initialCheckoutState, {
		type: 'open',
		product: purchase,
		requestId: 'first',
		token: 'proof',
	})
	state = checkoutReducer(state, { type: 'failed', requestId: 'first' })
	assert.equal(state.current.status, 'error')
	state = checkoutReducer(state, {
		type: 'open',
		product: purchase,
		requestId: 'discarded',
		token: 'discarded',
	})
	assert.equal(state.current.status, 'creating')
	if (state.current.status !== 'creating') throw new Error('Expected creation')
	assert.deepEqual(state.current.request, {
		product: 'purchase',
		requestId: 'first',
		token: 'proof',
	})
	state = checkoutReducer(state, { type: 'ready', requestId: 'first', session })
	assert.equal(state.current.status, 'ready')
	if (state.current.status !== 'ready') throw new Error('Expected payment details')
	assert.deepEqual(state.current.session, session)
	assert.deepEqual(state.current.product, purchase)
	state = checkoutReducer(state, { type: 'back' })
	assert.deepEqual(state.current, { status: 'selecting' })
	state = checkoutReducer(state, {
		type: 'open',
		product: subscription,
		requestId: 'second',
		token: 'other-proof',
	})
	state = checkoutReducer(state, { type: 'failed', requestId: 'second' })
	state = checkoutReducer(state, {
		type: 'open',
		product: purchase,
		requestId: 'discarded-again',
		token: 'discarded-again',
	})
	if (state.current.status !== 'creating') throw new Error('Expected creation')
	assert.equal(state.current.request.requestId, 'first')
	assert.equal(state.current.request.token, 'proof')
	assert.equal(state.attempts.get('subscription')?.token, 'other-proof')
	assert.equal(initialCheckoutState.attempts.size, 0)
})

test('checkout prevents overlapping creation and ignores unrelated or late responses', () => {
	const state = checkoutReducer(initialCheckoutState, {
		type: 'open',
		product: purchase,
		requestId: 'active',
		token: 'proof',
	})
	assert.equal(
		checkoutReducer(state, {
			type: 'open',
			product: subscription,
			requestId: 'duplicate',
			token: 'other',
		}),
		state,
	)
	assert.equal(checkoutReducer(state, { type: 'back' }), state)
	assert.equal(checkoutReducer(state, { type: 'ready', requestId: 'stale', session }), state)
	assert.equal(checkoutReducer(state, { type: 'failed', requestId: 'stale' }), state)
	const ready = checkoutReducer(state, { type: 'ready', requestId: 'active', session })
	assert.equal(checkoutReducer(ready, { type: 'failed', requestId: 'active' }), ready)
	const back = checkoutReducer(ready, { type: 'back' })
	assert.equal(checkoutReducer(back, { type: 'ready', requestId: 'active', session }), back)
})

test('payment polling uses elapsed time, not successful refetch counts, and stops after 30 seconds', () => {
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

test('payment polling stops immediately when no longer processing', () => {
	const poll = paymentPolling()
	assert.equal(poll('session', true, 0), 2500)
	assert.equal(poll('session', false, 2500), false)
	// A late provider response never gives this session a new deadline.
	assert.equal(poll('session', true, 40_000), false)
})

test('payment status presentation distinguishes processing, expiry, incomplete checkout and subscription success', () => {
	assert.deepEqual(paymentView('paid'), { kind: 'success', title: 'Payment successful.' })
	assert.deepEqual(paymentView('paid', 'subscription'), {
		kind: 'success',
		title: 'Subscription started.',
	})
	assert.equal(paymentView('expired').kind, 'error')
	assert.equal(paymentView('pending').title, 'Your payment is processing.')
	assert.equal(paymentView('open').title, 'Your checkout is incomplete.')
	assert.equal(paymentView('checking').kind, 'loading')
	assert.equal(paymentView('missing').kind, 'error')
	assert.equal(paymentView('error').kind, 'error')
})

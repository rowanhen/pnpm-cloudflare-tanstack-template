import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { checkoutReducer, initialCheckoutState } from '../checkout-session.ts'
import { getStorefrontProductMock } from '../../generated/schemas.faker.ts'
import { defineFixture } from '../../generated/index.fixtures.ts'

describe('checkout session', () => {
	test('when checkout retries or returns to products, buyer proof and idempotency persist', () => {
		const checkout = defineFixture('createStorefrontCheckout').reply()
		assert.ok(checkout.ok)
		const purchase = getStorefrontProductMock({ id: 'purchase', interval: null })
		const subscription = getStorefrontProductMock({ id: 'subscription', interval: 'month' })
		const session = checkout.body
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

	test('when checkout creation overlaps or responds late, unrelated results are ignored', () => {
		const checkout = defineFixture('createStorefrontCheckout').reply()
		assert.ok(checkout.ok)
		const purchase = getStorefrontProductMock({ id: 'purchase', interval: null })
		const subscription = getStorefrontProductMock({ id: 'subscription', interval: 'month' })
		const session = checkout.body
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
})

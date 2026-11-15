import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { paymentView } from '../payment-view.ts'

describe('payment view', () => {
	test('when payment status changes, the UI shows the corresponding state', () => {
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
})

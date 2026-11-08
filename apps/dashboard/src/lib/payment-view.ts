import type { StorefrontStatus } from '../generated/api.schemas'

type Status = StorefrontStatus['status'] | 'checking' | 'missing' | 'error'
export function paymentView(
	status: Status,
	mode: StorefrontStatus['mode'] = 'payment',
): {
	kind: 'success' | 'error' | 'loading'
	title: string
} {
	switch (status) {
		case 'paid':
			return {
				kind: 'success',
				title: mode === 'subscription' ? 'Subscription started.' : 'Payment successful.',
			}
		case 'expired':
			return { kind: 'error', title: 'This checkout has expired.' }
		case 'open':
			return { kind: 'loading', title: 'Your checkout is incomplete.' }
		case 'pending':
			return { kind: 'loading', title: 'Your payment is processing.' }
		case 'checking':
			return { kind: 'loading', title: 'Checking your payment…' }
		case 'missing':
			return { kind: 'error', title: 'Checkout not found.' }
		case 'error':
			return { kind: 'error', title: "Couldn't confirm your payment." }
	}
}

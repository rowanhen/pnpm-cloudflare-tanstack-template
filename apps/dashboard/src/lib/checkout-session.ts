import type {
	CreateStorefrontCheckout,
	StorefrontCheckout,
	StorefrontProduct,
} from '../generated/api.schemas'

type Attempt = { product: StorefrontProduct; request: CreateStorefrontCheckout }
export type CheckoutSelection =
	| { status: 'selecting' }
	| ({ status: 'creating' | 'error' } & Attempt)
	| ({ status: 'ready'; session: StorefrontCheckout } & Attempt)
export type CheckoutState = {
	current: CheckoutSelection
	// Retain credentials until unmount: Back and retries must reuse the same provider attempt.
	attempts: ReadonlyMap<StorefrontProduct['id'], CreateStorefrontCheckout>
}
export const initialCheckoutState: CheckoutState = {
	current: { status: 'selecting' },
	attempts: new Map(),
}
export type CheckoutAction =
	| { type: 'open'; product: StorefrontProduct; requestId: string; token: string }
	| { type: 'ready'; requestId: string; session: StorefrontCheckout }
	| { type: 'failed'; requestId: string }
	| { type: 'back' }

export function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
	const current = state.current
	switch (action.type) {
		case 'open': {
			if (current.status === 'creating') return state
			const request = state.attempts.get(action.product.id) ?? {
				product: action.product.id,
				requestId: action.requestId,
				token: action.token,
			}
			return {
				current: { status: 'creating', product: action.product, request },
				attempts: new Map(state.attempts).set(action.product.id, request),
			}
		}
		case 'back':
			return current.status === 'creating' ? state : { ...state, current: { status: 'selecting' } }
		case 'ready':
		case 'failed':
			if (current.status !== 'creating' || current.request.requestId !== action.requestId)
				return state
			return {
				...state,
				current:
					action.type === 'ready'
						? { ...current, status: 'ready', session: action.session }
						: { ...current, status: 'error' },
			}
	}
}

export function checkoutProofKey(sessionId: string) {
	return `storefront:${sessionId}`
}

// A manual refresh does not extend automatic verification. Each mounted session gets one window.
export function paymentPolling() {
	let deadline: number | undefined
	let session: string | undefined
	return (key: string, processing: boolean, now: number): number | false => {
		if (key !== session) {
			session = key
			deadline = undefined
		}
		if (!processing) return false
		deadline ??= now + 30_000
		return now < deadline ? Math.min(2500, deadline - now) : false
	}
}

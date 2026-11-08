import { useEffect, useReducer } from 'react'
import { createStorefrontCheckout } from '../generated/storefront'
import type { StorefrontProduct } from '../generated/api.schemas'
import { checkoutProofKey, checkoutReducer, initialCheckoutState } from '../lib/checkout-session'

export function useStorefrontCheckout() {
	const [state, dispatch] = useReducer(checkoutReducer, initialCheckoutState)
	const current = state.current
	useEffect(() => {
		if (current.status !== 'creating') return
		let active = true
		const { request } = current
		async function create() {
			try {
				const { data: session } = await createStorefrontCheckout(request)
				if (!active) return
				// A checkout is usable only once its buyer proof survives the provider redirect.
				sessionStorage.setItem(checkoutProofKey(session.sessionId), request.token)
				dispatch({ type: 'ready', requestId: request.requestId, session })
			} catch {
				if (active) dispatch({ type: 'failed', requestId: request.requestId })
			}
		}
		void create()
		return () => {
			active = false
		}
	}, [current])
	return {
		state: current,
		open: (product: StorefrontProduct) =>
			dispatch({
				type: 'open',
				product,
				requestId: crypto.randomUUID(),
				token: crypto.randomUUID(),
			}),
		back: () => dispatch({ type: 'back' }),
	}
}

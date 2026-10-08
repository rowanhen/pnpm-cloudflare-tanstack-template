// Keep return destinations explicit: never redirect to a URL supplied by a visitor.
export function checkoutSessionId(value: unknown) {
	return typeof value === 'string' && /^cs_test_[A-Za-z0-9]{1,240}$/.test(value) ? value : ''
}

export function loginSearch(search: Record<string, unknown>): {
	next?: 'checkout' | 'checkout-success'
	session_id?: string
	error?: 'cancelled' | 'failed'
} {
	return {
		next:
			search.next === 'checkout' || search.next === 'checkout-success' ? search.next : undefined,
		session_id:
			search.next === 'checkout-success' ? checkoutSessionId(search.session_id) : undefined,
		error:
			typeof search.error === 'string'
				? search.error === 'access_denied' || search.error === 'cancelled'
					? 'cancelled'
					: 'failed'
				: undefined,
	}
}

export function loginReturnPath(search: ReturnType<typeof loginSearch>) {
	if (search.next === 'checkout-success' && search.session_id)
		return `/checkout/success?session_id=${encodeURIComponent(search.session_id)}`
	return search.next ? '/checkout' : '/'
}

export function signInPath(pathname: string, search: Record<string, unknown>) {
	const params = new URLSearchParams()
	if (pathname === '/checkout/success' && checkoutSessionId(search.session_id)) {
		params.set('next', 'checkout-success')
		params.set('session_id', checkoutSessionId(search.session_id))
	} else if (pathname === '/checkout' || pathname.startsWith('/checkout/')) {
		params.set('next', 'checkout')
	}
	return `/login${params.size ? `?${params}` : ''}`
}

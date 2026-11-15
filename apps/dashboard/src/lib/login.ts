import { checkoutSessionId } from '@workspace/shared/lib/checkout-session-id'

export function loginSearch(search: Record<string, unknown>): {
	next?: 'credits' | 'checkout-success'
	session_id?: string
	error?: 'cancelled' | 'failed'
} {
	return {
		next: search.next === 'credits' || search.next === 'checkout-success' ? search.next : undefined,
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
	return search.next === 'credits' ? '/credits' : '/'
}

export function signInPath(pathname: string, search: Record<string, unknown>) {
	const params = new URLSearchParams()
	if (pathname === '/checkout/success' && checkoutSessionId(search.session_id)) {
		params.set('next', 'checkout-success')
		params.set('session_id', checkoutSessionId(search.session_id))
	} else if (pathname === '/credits') {
		params.set('next', 'credits')
	}
	return `/login${params.size ? `?${params}` : ''}`
}

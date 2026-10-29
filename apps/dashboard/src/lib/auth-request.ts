import { observedFetch, resetUser } from '@workspace/observability/browser'
import { signInPath } from './login'
export async function authRequest(path: `/api/auth/${string}`, init: RequestInit = {}) {
	const response = await observedFetch(path, { ...init, credentials: 'same-origin' })
	if (response.status === 401) {
		resetUser()
		window.location.assign(
			signInPath(
				window.location.pathname,
				Object.fromEntries(new URLSearchParams(window.location.search)),
			),
		)
		throw new Error('Your session expired. Please sign in again.')
	}
	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as { error?: string }
		throw new Error(body.error ?? `Request failed (${response.status})`)
	}
	return response
}

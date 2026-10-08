import { createClient } from '@workspace/contracts/client'
export async function api(path: string, init: RequestInit = {}) {
	const response = await fetch(path, { ...init, credentials: 'same-origin' })
	if (response.status === 401) {
		window.location.assign('/login')
		throw new Error('Your session expired. Please sign in again.')
	}
	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as { error?: string }
		throw new Error(body.error ?? `Request failed (${response.status})`)
	}
	return response
}

export const client = createClient(api)

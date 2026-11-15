import { fetchApi } from '@workspace/shared/server-proxy'
import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'

import type { User } from '@workspace/contracts'
import { apiTarget } from './proxy.server'
export type { User } from '@workspace/contracts'
export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
	setResponseHeader('Cache-Control', 'private, no-store')
	const request = getRequest()
	const response = await fetchApi(request, '/api/auth/get-session', {}, apiTarget)
	if (!response.ok) throw new Error('Unable to check your session. Please try again.')
	const session = (await response.json()) as { user: User } | null
	return session?.user ?? null
})

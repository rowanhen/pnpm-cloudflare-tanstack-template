import { backendHeaders } from '@workspace/shared/server-proxy'
import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'

export type User = {
	id: string
	name: string
	email: string
	emailVerified: boolean
	image?: string | null
}
export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
	setResponseHeader('Cache-Control', 'private, no-store')
	const request = getRequest()
	const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:8787').replace(/\/$/, '')
	const response = await fetch(`${base}/api/auth/get-session`, {
		headers: await backendHeaders(request, base),
		signal: AbortSignal.timeout(15000),
	})
	if (!response.ok) throw new Error('Unable to check your session. Please try again.')
	const session = (await response.json()) as { user: User } | null
	return session?.user ?? null
})

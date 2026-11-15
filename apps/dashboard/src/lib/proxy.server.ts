import { proxyApi as proxy } from '@workspace/shared/server-proxy'
import { setResponseStatus } from '@tanstack/react-start/server'

export const apiTarget = {
	dev: import.meta.env.DEV,
	localUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8787',
}

export async function proxyApi(request: Request) {
	const response = await proxy(request, apiTarget)
	setResponseStatus(response.status)
	return response
}

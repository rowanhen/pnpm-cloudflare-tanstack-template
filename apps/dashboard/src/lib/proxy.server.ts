import { proxyApi as proxy } from '@workspace/shared/server-proxy'
import { setResponseStatus } from '@tanstack/react-start/server'

export async function proxyApi(request: Request) {
	const response = await proxy(
		request,
		(import.meta.env.VITE_API_URL ?? 'http://localhost:8787').replace(/\/$/, ''),
	)
	setResponseStatus(response.status)
	return response
}

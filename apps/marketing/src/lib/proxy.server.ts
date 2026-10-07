import { proxyApi as proxy } from '@workspace/shared/server-proxy'
export function proxyApi(request: Request) {
	return proxy(
		request,
		(import.meta.env.VITE_API_URL ?? 'http://localhost:8787').replace(/\/$/, ''),
	)
}

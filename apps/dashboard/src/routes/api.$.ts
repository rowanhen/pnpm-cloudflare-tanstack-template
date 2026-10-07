import { createFileRoute } from '@tanstack/react-router'
import { proxyApi } from '../lib/proxy.server'

export const Route = createFileRoute('/api/$')({
	server: {
		handlers: {
			GET: ({ request }) => proxyApi(request),
			POST: ({ request }) => proxyApi(request),
			PATCH: ({ request }) => proxyApi(request),
			PUT: ({ request }) => proxyApi(request),
			DELETE: ({ request }) => proxyApi(request),
			HEAD: ({ request }) => proxyApi(request),
			OPTIONS: ({ request }) => proxyApi(request),
		},
	},
})

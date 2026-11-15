import { createFileRoute } from '@tanstack/react-router'
import { proxyApi } from '../../lib/proxy.server'

export const Route = createFileRoute('/api/storefront')({
	server: { handlers: { GET: ({ request }) => proxyApi(request) } },
})

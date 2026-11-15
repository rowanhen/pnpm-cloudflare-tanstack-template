import { createFileRoute } from '@tanstack/react-router'
import { proxyApi } from '../../../lib/proxy.server'

export const Route = createFileRoute('/api/storefront/checkouts')({
	server: { handlers: { POST: ({ request }) => proxyApi(request) } },
})

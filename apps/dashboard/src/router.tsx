import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
	const queryClient = new QueryClient()
	return createRouter({
		routeTree,
		context: { queryClient },
		defaultPreload: 'intent',
		scrollRestoration: true,
		Wrap: ({ children }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	})
}

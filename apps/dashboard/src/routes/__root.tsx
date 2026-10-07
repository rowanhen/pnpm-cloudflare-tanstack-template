import { appMetaDescription, appTitle } from '@workspace/shared'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient
}>()({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'robots', content: 'noindex, nofollow' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ title: appTitle('Dashboard') },
			{
				name: 'description',
				content: appMetaDescription('dashboard'),
			},
		],
	}),
	component: RootComponent,
})

function RootComponent() {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body style={{ margin: 0 }}>
				<Outlet />
				<Scripts />
			</body>
		</html>
	)
}

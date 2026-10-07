import type { ReactNode } from 'react'
import { appMetaDescription, appTitle, ErrorPage, NotFoundPage } from '@workspace/shared'
import styles from '@workspace/shared/styles.css?url'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient
}>()({
	head: () => ({
		links: [{ rel: 'stylesheet', href: styles }],
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
	component: Outlet,
	shellComponent: RootComponent,
	notFoundComponent: NotFoundPage,
	errorComponent: () => <ErrorPage />,
})

function RootComponent({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	)
}

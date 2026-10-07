import type { ReactNode } from 'react'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ErrorPage, NotFoundPage } from '@workspace/shared'
import styles from '@workspace/shared/styles.css?url'

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient
}>()({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
		],
		links: [
			{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
			{ rel: 'stylesheet', href: styles },
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

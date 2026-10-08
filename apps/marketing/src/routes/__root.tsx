import { Analytics } from '@workspace/shared/components/analytics'
import type { ReactNode } from 'react'
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRouteWithContext,
	useRouterState,
} from '@tanstack/react-router'
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
	errorComponent: ({ error }) => <ErrorPage error={error} />,
})

const analyticsConfig = {
	key: import.meta.env.VITE_POSTHOG_KEY,
	host: import.meta.env.VITE_POSTHOG_HOST,
	app: 'marketing' as const,
	environment: import.meta.env.VITE_APP_ENV ?? 'development',
	privacyUrl: `${import.meta.env.VITE_SITE_URL ?? 'http://localhost:3000'}/privacy`,
}
function RootComponent({ children }: { children: ReactNode }) {
	const pathname = useRouterState({ select: (state) => state.location.pathname })
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Analytics config={analyticsConfig} pathname={pathname} />
				<Scripts />
			</body>
		</html>
	)
}

import { Analytics } from '@workspace/shared/components/analytics'
import type { ReactNode } from 'react'
import { appMetaDescription, appTitle, ErrorPage, NotFoundPage } from '@workspace/shared'
import styles from '@workspace/shared/styles.css?url'
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRouteWithContext,
	useRouterState,
} from '@tanstack/react-router'
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
	errorComponent: ({ error }) => <ErrorPage error={error} />,
})

const analyticsConfig = {
	key: import.meta.env.VITE_POSTHOG_KEY,
	host: import.meta.env.VITE_POSTHOG_HOST,
	app: 'dashboard' as const,
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

import { Link } from '@tanstack/react-router'
import { Button, Stack } from '@leitware/composables'
import { useEffect } from 'react'
import { reportError } from '@workspace/observability/browser'
import type { ReactNode } from 'react'
import { AppShell } from './app-shell'

export function PageState({
	kind,
	title,
	description,
	children,
}: {
	kind: 'success' | 'error' | 'not-found' | 'loading'
	title: string
	description?: string
	children?: ReactNode
}) {
	return (
		<AppShell title={title} description={description}>
			<Stack
				gap={3}
				direction="horizontal"
				align="center"
				wrap
				data-page-state={kind}
				aria-busy={kind === 'loading'}
			>
				{children}
			</Stack>
		</AppShell>
	)
}

export function NotFoundPage() {
	return (
		<PageState kind="not-found" title="Page not found">
			<Button
				{...{ nativeButton: false }}
				render={<Link aria-label="Back to home" role="link" to="/" />}
			>
				Back to home
			</Button>
		</PageState>
	)
}

export function ErrorPage({ retry, error }: { retry?: () => void; error?: unknown }) {
	useEffect(() => {
		if (error) reportError(error, 'route')
	}, [error])
	return (
		<PageState kind="error" title="Couldn't load this page">
			<Button onClick={retry ?? (() => window.location.reload())}>Try again</Button>
			<Button
				variant="outline"
				{...{ nativeButton: false }}
				render={<Link aria-label="Back to home" role="link" to="/" />}
			>
				Back to home
			</Button>
		</PageState>
	)
}

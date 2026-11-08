import { LinkButton } from './link-button'
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
			<LinkButton aria-label="Back to home" to="/">
				Back to home
			</LinkButton>
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
			<LinkButton variant="outline" aria-label="Back to home" to="/">
				Back to home
			</LinkButton>
		</PageState>
	)
}

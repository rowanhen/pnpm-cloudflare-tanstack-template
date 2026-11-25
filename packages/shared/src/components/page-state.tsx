import { LinkButton } from './link-button'
import { Button } from '@leitware/composables'
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
			<div
				data-page-state={kind}
				aria-busy={kind === 'loading'}
				className="flex min-w-0 items-center flex-wrap gap-3"
			>
				{children}
			</div>
		</AppShell>
	)
}

export function NotFoundPage() {
	return (
		<PageState kind="not-found" title="Page not found">
			<LinkButton variant="primary" aria-label="Back to home" to="/">
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
			<Button variant="primary" onClick={retry ?? (() => window.location.reload())}>
				Try again
			</Button>
			<LinkButton variant="default" aria-label="Back to home" to="/">
				Back to home
			</LinkButton>
		</PageState>
	)
}

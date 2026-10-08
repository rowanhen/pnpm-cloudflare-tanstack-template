import { useEffect } from 'react'
import { reportError } from '@workspace/observability/browser'
import type { ReactNode } from 'react'
import { AlertCircle, Check, Compass, LoaderCircle } from 'lucide-react'
import { Card, Stack, Typography } from '@leitware/composables'
import { Button } from './ui/button'

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
	const Icon = { success: Check, error: AlertCircle, 'not-found': Compass, loading: LoaderCircle }[
		kind
	]
	return (
		<main className="flex min-h-svh items-center justify-center px-5 py-16">
			<Card className="w-full max-w-lg text-center">
				<Stack gap={6} className="py-6">
					<div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface-brand text-icon-brand">
						<Icon
							aria-hidden="true"
							className={kind === 'loading' ? 'size-6 animate-spin' : 'size-6'}
						/>
					</div>
					<Stack gap={3}>
						<Typography as="h1" variant="heading-500">
							{title}
						</Typography>
						{description && (
							<Typography variant="body-100" className="text-content-secondary">
								{description}
							</Typography>
						)}
					</Stack>
					{children && (
						<Stack direction="horizontal" wrap justify="center" gap={3}>
							{children}
						</Stack>
					)}
				</Stack>
			</Card>
		</main>
	)
}

export function NotFoundPage() {
	return (
		<PageState kind="not-found" title="Page not found" description="404">
			<Button asChild>
				<a href="/">Back to home</a>
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
			<Button variant="outline" asChild>
				<a href="/">Back to home</a>
			</Button>
		</PageState>
	)
}

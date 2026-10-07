import type { ReactNode } from 'react'
import { AlertCircle, Check, Compass, LoaderCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'

export function PageState({
	kind,
	title,
	description,
	children,
}: {
	kind: 'success' | 'error' | 'not-found' | 'loading'
	title: string
	description: string
	children?: ReactNode
}) {
	const Icon = { success: Check, error: AlertCircle, 'not-found': Compass, loading: LoaderCircle }[
		kind
	]
	return (
		<main className="flex min-h-svh items-center justify-center px-5 py-16">
			<Card className="w-full max-w-lg text-center shadow-sm">
				<CardContent className="space-y-6 py-6">
					<div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
						<Icon
							aria-hidden="true"
							className={kind === 'loading' ? 'size-6 animate-spin' : 'size-6'}
						/>
					</div>
					<Badge variant="outline">
						{kind === 'not-found'
							? '404 · Page not found'
							: kind === 'error'
								? 'Something went wrong'
								: kind === 'loading'
									? 'One moment'
									: 'All set'}
					</Badge>
					<div className="space-y-3">
						<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
						<p className="text-sm leading-6 text-muted-foreground">{description}</p>
					</div>
					<div className="flex flex-wrap justify-center gap-3">{children}</div>
				</CardContent>
			</Card>
		</main>
	)
}

export function NotFoundPage() {
	return (
		<PageState
			kind="not-found"
			title="A little off the map."
			description="This page may have moved, or the link might be incomplete. Let's get you back to familiar ground."
		>
			<Button asChild>
				<a href="/">Back to home</a>
			</Button>
		</PageState>
	)
}

export function ErrorPage({ retry }: { retry?: () => void }) {
	return (
		<PageState
			kind="error"
			title="Let's try that again."
			description="We couldn't load this page. Please try again in a moment."
		>
			<Button onClick={retry ?? (() => window.location.reload())}>Try again</Button>
			<Button variant="outline" asChild>
				<a href="/">Back to home</a>
			</Button>
		</PageState>
	)
}

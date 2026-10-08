import type { ReactNode } from 'react'
import { ArrowUpRight, Layers3 } from 'lucide-react'
import { Typography } from '@leitware/composables'
import { Button } from './components/ui/button'

export { PROJECT_NAME, appMetaDescription, appTitle } from './project'
export { Button, buttonVariants } from './components/ui/button'
export {
	Card,
	Input,
	Label,
	Checkbox,
	Badge,
	Alert,
	Separator,
	Skeleton,
	Stack,
	Typography,
} from '@leitware/composables'
export { PageState, ErrorPage, NotFoundPage } from './components/page-state'
export { useHydrated } from './hooks/use-hydrated'
export { cn } from './lib/utils'

export function AppShell({
	title,
	description,
	children,
	actions,
}: {
	title: string
	description?: string
	children: ReactNode
	actions?: ReactNode
}) {
	return (
		<div className="min-h-svh">
			<header className="border-b bg-surface-default">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
					<a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
						<Layers3 className="size-5 text-icon-brand" aria-hidden="true" />
						Idea Starter
					</a>
					<nav aria-label="Workspace navigation" className="flex items-center gap-2">
						<Button asChild variant="ghost" size="sm">
							<a href="/checkout">
								Test checkout
								<ArrowUpRight aria-hidden="true" />
							</a>
						</Button>
						{actions}
					</nav>
				</div>
			</header>
			<main className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8 sm:py-14">
				<div className="max-w-2xl space-y-3">
					<Typography as="h1" variant="heading-500">
						{title}
					</Typography>
					{description && <p className="text-sm text-content-secondary">{description}</p>}
				</div>
				{children}
			</main>
		</div>
	)
}

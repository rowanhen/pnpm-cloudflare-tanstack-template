import type { ReactNode } from 'react'
import { ArrowUpRight, Layers3 } from 'lucide-react'
import { Button } from './components/ui/button'

export { PROJECT_NAME, appMetaDescription, appTitle } from './project'
export { Button, buttonVariants } from './components/ui/button'
export {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from './components/ui/card'
export { Input } from './components/ui/input'
export { Label } from './components/ui/label'
export { Checkbox } from './components/ui/checkbox'
export { Badge } from './components/ui/badge'
export { Alert, AlertTitle, AlertDescription } from './components/ui/alert'
export { Separator } from './components/ui/separator'
export { Skeleton } from './components/ui/skeleton'
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
	description: string
	children: ReactNode
	actions?: ReactNode
}) {
	return (
		<div className="min-h-svh">
			<header className="border-b bg-card">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
					<a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
						<Layers3 className="size-5 text-primary" aria-hidden="true" />
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
					<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
					<p className="leading-7 text-muted-foreground">{description}</p>
				</div>
				{children}
			</main>
			<footer className="mx-auto max-w-6xl px-5 pb-8 text-xs text-muted-foreground sm:px-8">
				A little less setup. A little more creating.
			</footer>
		</div>
	)
}

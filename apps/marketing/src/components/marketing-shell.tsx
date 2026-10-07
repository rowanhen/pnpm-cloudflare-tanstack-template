import type { ReactNode } from 'react'
import { Button, Separator } from '@workspace/shared'
import { site } from '../lib/seo'

export function MarketingShell({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-svh">
			<header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
				<a href="/" className="text-lg font-semibold tracking-tight">
					{site.name}
					<span className="text-primary">.</span>
				</a>
				<Button asChild variant="outline" size="sm">
					<a href={site.dashboard}>Your workspace ↗</a>
				</Button>
			</header>
			<main className="mx-auto max-w-6xl px-5 sm:px-8">{children}</main>
			<footer className="mx-auto max-w-6xl space-y-6 px-5 pb-8 pt-16 sm:px-8">
				<Separator />
				<div className="flex flex-wrap justify-between gap-4 text-sm text-muted-foreground">
					<p>{site.name} · A little idea. A good beginning.</p>
					<nav aria-label="Footer navigation" className="flex gap-5">
						<a className="hover:text-foreground" href="/privacy">
							Privacy
						</a>
						<a className="hover:text-foreground" href={site.dashboard}>
							Sign in
						</a>
					</nav>
				</div>
			</footer>
		</div>
	)
}

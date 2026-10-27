/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Composables renders anchors below; override Base UI's default button role. */
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, Separator, Typography } from '@leitware/composables'
import { repository, site } from '../lib/seo'

export function MarketingShell({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-svh">
			<header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
				<Link to="/">
					<Typography as="span" variant="brand-heading-300">
						{site.name}
						<Typography as="span" variant="brand-heading-300" className="text-brand">
							.
						</Typography>
					</Typography>
				</Link>
				<nav aria-label="Main navigation" className="flex items-center gap-4">
					<Button
						role="link"
						{...{ nativeButton: false }}
						variant="link"
						className="hidden sm:inline-flex"
						render={<Link to="/" hash="setup" />}
					>
						Setup
					</Button>
					<Button
						role="link"
						{...{ nativeButton: false }}
						variant="link"
						className="hidden sm:inline-flex"
						render={<a href={repository} aria-label="GitHub" />}
					>
						GitHub ↗
					</Button>
					<Button
						role="link"
						{...{ nativeButton: false }}
						variant="outline"
						size="sm"
						render={<a href={site.dashboard} aria-label="Sign in" />}
					>
						Sign in ↗
					</Button>
				</nav>
			</header>
			<main className="mx-auto max-w-6xl px-5 sm:px-8">{children}</main>
			<footer className="mx-auto max-w-6xl space-y-6 px-5 pb-8 pt-16 sm:px-8">
				<Separator />
				<div className="flex flex-wrap justify-between gap-4">
					<Button
						role="link"
						{...{ nativeButton: false }}
						variant="link"
						render={<a href="https://leitware.com" aria-label="Built by Leitware" />}
					>
						Built by Leitware ↗
					</Button>
					<nav aria-label="Footer navigation" className="flex gap-5">
						<Button
							role="link"
							{...{ nativeButton: false }}
							variant="link"
							render={<Link to="/privacy" />}
						>
							Privacy
						</Button>
						<Button
							role="link"
							{...{ nativeButton: false }}
							variant="link"
							render={<a href={site.dashboard} aria-label="Sign in" />}
						>
							Sign in
						</Button>
					</nav>
				</div>
			</footer>
		</div>
	)
}

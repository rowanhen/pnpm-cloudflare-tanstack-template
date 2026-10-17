import { Button, Container, Stack } from '@workspace/shared'
import { Link } from '@tanstack/react-router'

import type { ReactNode } from 'react'

import { repository, site } from '../lib/seo'

export function MarketingShell({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-svh">
			<Container maxWidth="md">
				<header className="flex items-center justify-between gap-4 border-b py-6">
					<Button
						variant="ghost"
						{...{ nativeButton: false }}
						render={<Link aria-label={site.name} role="link" to="/" />}
					>
						{site.name}
					</Button>
					<nav aria-label="Main navigation" className="flex items-center gap-4">
						<Button
							variant="ghost"
							{...{ nativeButton: false }}
							render={<Link aria-label="Setup" role="link" to="/" hash="setup" />}
							className="hidden sm:inline-flex"
						>
							Setup
						</Button>
						<Button
							variant="ghost"
							{...{ nativeButton: false }}
							render={<a role="link" aria-label="GitHub" href={repository} />}
							className="hidden sm:inline-flex"
						>
							GitHub ↗
						</Button>
						<Button
							variant="ghost"
							{...{ nativeButton: false }}
							render={<a role="link" aria-label="Sign in" href={site.dashboard} />}
						>
							Sign in ↗
						</Button>
					</nav>
				</header>
				<main>{children}</main>
				<footer className="border-t py-8">
					<Stack gap={4} direction="horizontal" justify="between" wrap>
						<Button
							variant="ghost"
							{...{ nativeButton: false }}
							render={<a role="link" aria-label="Built by Leitware" href="https://leitware.com" />}
						>
							Built by Leitware ↗
						</Button>
						<nav aria-label="Footer navigation" className="flex gap-5">
							<Button
								variant="ghost"
								{...{ nativeButton: false }}
								render={<Link aria-label="Privacy" role="link" to="/privacy" />}
							>
								Privacy
							</Button>
							<Button
								variant="ghost"
								{...{ nativeButton: false }}
								render={<a role="link" aria-label="Sign in" href={site.dashboard} />}
							>
								Sign in
							</Button>
						</nav>
					</Stack>
				</footer>
			</Container>
		</div>
	)
}

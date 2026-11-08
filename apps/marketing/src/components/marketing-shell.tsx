import { AnchorButton, LinkButton, Container, Stack } from '@workspace/shared'

import type { ReactNode } from 'react'

import { repository, site } from '../lib/seo'

export function MarketingShell({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-svh">
			<Container maxWidth="md">
				<header className="flex items-center justify-between gap-4 border-b py-6">
					<LinkButton variant="ghost" aria-label={site.name} to="/">
						{site.name}
					</LinkButton>
					<nav aria-label="Main navigation" className="flex items-center gap-4">
						<LinkButton
							variant="ghost"
							aria-label="Setup"
							to="/"
							hash="setup"
							className="hidden sm:inline-flex"
						>
							Setup
						</LinkButton>
						<AnchorButton
							variant="ghost"
							aria-label="GitHub"
							href={repository}
							className="hidden sm:inline-flex"
						>
							GitHub ↗
						</AnchorButton>
						<AnchorButton variant="ghost" aria-label="Sign in" href={site.dashboard}>
							Sign in ↗
						</AnchorButton>
					</nav>
				</header>
				<main>{children}</main>
				<footer className="border-t py-8">
					<Stack gap={4} direction="horizontal" justify="between" wrap>
						<AnchorButton
							variant="ghost"
							aria-label="Built by Leitware"
							href="https://leitware.com"
						>
							Built by Leitware ↗
						</AnchorButton>
						<nav aria-label="Footer navigation" className="flex gap-5">
							<LinkButton variant="ghost" aria-label="Privacy" to="/privacy">
								Privacy
							</LinkButton>
							<AnchorButton variant="ghost" aria-label="Sign in" href={site.dashboard}>
								Sign in
							</AnchorButton>
						</nav>
					</Stack>
				</footer>
			</Container>
		</div>
	)
}

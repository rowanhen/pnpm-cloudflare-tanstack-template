import { useLoaderData, useParams } from '@tanstack/react-router'
import { AnchorButton, LinkButton } from '@workspace/shared'
import { repository, site } from '../../lib/seo'

export function MarketingHeader() {
	const { locale } = useParams({ from: '/$locale' })
	const copy = useLoaderData({ from: '/$locale' })
	return (
		<header className="flex items-center justify-between gap-4 border-b py-6">
			<LinkButton variant="ghost" aria-label={site.name} to="/$locale" params={{ locale }}>
				{site.name}
			</LinkButton>
			<nav aria-label="Main navigation" className="flex items-center gap-4">
				<LinkButton
					variant="ghost"
					aria-label={copy.headerSetup}
					to="/$locale"
					params={{ locale }}
					hash="setup"
					className="hidden sm:inline-flex"
				>
					{copy.headerSetup}
				</LinkButton>
				<AnchorButton
					variant="ghost"
					aria-label={copy.headerGitHub}
					href={repository}
					className="hidden sm:inline-flex"
				>
					{copy.headerGitHub} ↗
				</AnchorButton>
				<AnchorButton variant="ghost" aria-label={copy.headerSignIn} href={site.dashboard}>
					{copy.headerSignIn} ↗
				</AnchorButton>
			</nav>
		</header>
	)
}

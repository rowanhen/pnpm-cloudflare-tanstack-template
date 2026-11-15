import { useLoaderData, useParams } from '@tanstack/react-router'
import { Stack } from '@leitware/composables'
import { AnchorButton, LinkButton } from '@workspace/shared'
import { site } from '../../lib/seo'

export function MarketingFooter() {
	const { locale } = useParams({ from: '/$locale' })
	const copy = useLoaderData({ from: '/$locale' })
	return (
		<footer className="border-t py-8">
			<Stack gap={4} direction="horizontal" justify="between" wrap>
				<AnchorButton variant="ghost" aria-label={copy.footerBuiltBy} href="https://leitware.com">
					{copy.footerBuiltBy} ↗
				</AnchorButton>
				<nav aria-label="Footer navigation" className="flex gap-5">
					<LinkButton
						variant="ghost"
						aria-label={copy.footerPrivacy}
						to="/$locale/privacy"
						params={{ locale }}
					>
						{copy.footerPrivacy}
					</LinkButton>
					<AnchorButton variant="ghost" aria-label={copy.footerSignIn} href={site.dashboard}>
						{copy.footerSignIn}
					</AnchorButton>
				</nav>
			</Stack>
		</footer>
	)
}

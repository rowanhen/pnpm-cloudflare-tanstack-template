import { AnchorButton, LinkButton, PageState } from '@workspace/shared'
import { createFileRoute } from '@tanstack/react-router'

import { site } from '../../../lib/seo'

export const Route = createFileRoute('/$locale/waitlist/success')({
	head: () => ({
		meta: [
			{ title: `You're on the list — ${site.name}` },
			{ name: 'robots', content: 'noindex, nofollow' },
		],
	}),
	component: SuccessPage,
})

function SuccessPage() {
	const { locale } = Route.useParams()
	return (
		<div>
			<PageState kind="success" title="You're on the list.">
				<AnchorButton variant="primary" aria-label="Open workspace" href={site.dashboard}>
					Open workspace
				</AnchorButton>
				<LinkButton variant="default" aria-label="Back to home" to="/$locale" params={{ locale }}>
					Back to home
				</LinkButton>
			</PageState>
		</div>
	)
}

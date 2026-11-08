import { AnchorButton, LinkButton, PageState } from '@workspace/shared'
import { createFileRoute } from '@tanstack/react-router'

import { site } from '../lib/seo'

export const Route = createFileRoute('/waitlist/success')({
	head: () => ({
		meta: [
			{ title: `You're on the list — ${site.name}` },
			{ name: 'robots', content: 'noindex, nofollow' },
		],
	}),
	component: () => (
		<div>
			<PageState kind="success" title="You're on the list.">
				<AnchorButton aria-label="Open workspace" href={site.dashboard}>
					Open workspace
				</AnchorButton>
				<LinkButton variant="outline" aria-label="Back to home" to="/">
					Back to home
				</LinkButton>
			</PageState>
		</div>
	),
})

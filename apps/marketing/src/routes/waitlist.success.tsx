import { Link, createFileRoute } from '@tanstack/react-router'

import { Button, PageState } from '@workspace/shared'
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
				<Button
					{...{ nativeButton: false }}
					render={<a role="link" aria-label="Open workspace" href={site.dashboard} />}
				>
					Open workspace
				</Button>
				<Button
					variant="outline"
					{...{ nativeButton: false }}
					render={<Link aria-label="Back to home" role="link" to="/" />}
				>
					Back to home
				</Button>
			</PageState>
		</div>
	),
})

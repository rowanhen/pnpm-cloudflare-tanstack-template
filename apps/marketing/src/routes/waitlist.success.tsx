import { createFileRoute } from '@tanstack/react-router'
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
				<Button asChild>
					<a href={site.dashboard}>Open workspace</a>
				</Button>
				<Button variant="outline" asChild>
					<a href="/">Back to home</a>
				</Button>
			</PageState>
		</div>
	),
})

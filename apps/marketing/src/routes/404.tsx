import { createFileRoute } from '@tanstack/react-router'
import { NotFoundScreen } from './-components/not-found'

export const Route = createFileRoute('/404')({
	head: () => ({
		meta: [{ title: 'Page not found' }, { name: 'robots', content: 'noindex, nofollow' }],
	}),
	component: NotFoundScreen,
})

import { createFileRoute } from '@tanstack/react-router'
import { ErrorScreen } from './-components/error'

export const Route = createFileRoute('/error')({
	head: () => ({
		meta: [{ title: 'Something went wrong' }, { name: 'robots', content: 'noindex, nofollow' }],
	}),
	component: ErrorScreen,
})

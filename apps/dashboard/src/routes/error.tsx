import { createFileRoute } from '@tanstack/react-router'
import { ErrorPage } from '@workspace/shared'
export const Route = createFileRoute('/error')({
	head: () => ({ meta: [{ title: 'Something went wrong' }] }),
	component: ErrorPage,
})

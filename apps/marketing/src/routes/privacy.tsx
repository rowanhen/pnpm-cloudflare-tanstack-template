import { createFileRoute, notFound } from '@tanstack/react-router'
import { getPage } from '../publishing/catalog'
import { ContentPage, pageHead } from '../publishing/page'

export const Route = createFileRoute('/privacy')({
	loader: async () => {
		const page = await getPage({ data: '/privacy' })
		if (!page) throw notFound()
		return page
	},
	head: ({ loaderData }) => (loaderData ? pageHead(loaderData) : {}),
	component: () => <ContentPage page={Route.useLoaderData()} />,
})

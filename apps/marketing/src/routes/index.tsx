import { createFileRoute, notFound } from '@tanstack/react-router'
import { getPage } from '../publishing/functions'
import { ContentPage, pageHead } from '../publishing/page'

export const Route = createFileRoute('/')({
	loader: async () => {
		const page = await getPage({ data: '/' })
		if (!page) throw notFound()
		return page
	},
	head: ({ loaderData }) => (loaderData ? pageHead(loaderData) : {}),
	component: () => <ContentPage page={Route.useLoaderData()} />,
})

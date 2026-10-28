import { createFileRoute, notFound } from '@tanstack/react-router'
import { getPage } from '../publishing/catalog'
import { ContentPage, pageHead } from '../publishing/page'
import { findPage } from '../publishing/catalog.server'
import { renderMarkdown } from '../publishing/markdown'
import { site } from '../lib/seo'

export const Route = createFileRoute('/$')({
	server: {
		handlers: {
			GET: ({ request, next }) => {
				const path = new URL(request.url).pathname
				if (!path.endsWith('.md')) return next()
				const page = findPage(path === '/index.md' ? '/' : path.slice(0, -3))
				return new Response(page ? renderMarkdown(page, site.url) : 'Not found', {
					status: page ? 200 : 404,
					headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'X-Robots-Tag': 'noindex' },
				})
			},
		},
	},
	loader: async ({ params }) => {
		// TanStack names its catch-all parameter _splat.
		// oxlint-disable-next-line no-underscore-dangle
		const page = await getPage({ data: `/${params._splat ?? ''}` })
		if (!page) throw notFound()
		return page
	},
	head: ({ loaderData }) => (loaderData ? pageHead(loaderData) : {}),
	component: () => <ContentPage page={Route.useLoaderData()} />,
})

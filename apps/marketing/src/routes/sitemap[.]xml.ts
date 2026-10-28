import { createFileRoute } from '@tanstack/react-router'
import { pages } from '../publishing/catalog.server'
import { renderSitemap } from '../publishing/markdown'
import { site, indexable } from '../lib/seo'

export const Route = createFileRoute('/sitemap.xml')({
	server: {
		handlers: {
			GET: () =>
				new Response(renderSitemap(indexable ? pages : [], site.url), {
					headers: { 'Content-Type': 'application/xml; charset=utf-8' },
				}),
		},
	},
})

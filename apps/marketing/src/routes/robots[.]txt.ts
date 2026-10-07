import { createFileRoute } from '@tanstack/react-router'
import { site, indexable } from '../lib/seo'
export const Route = createFileRoute('/robots.txt')({
	server: {
		handlers: {
			GET: () =>
				new Response(
					indexable
						? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${site.url}/sitemap.xml\n`
						: 'User-agent: *\nDisallow: /\n',
					{ headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
				),
		},
	},
})

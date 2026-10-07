import { createFileRoute } from '@tanstack/react-router'
import { site } from '../lib/seo'
export const Route = createFileRoute('/sitemap.xml')({
	server: {
		handlers: {
			GET: () => {
				const escape = (value: string) =>
					value
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;')
						.replace(/"/g, '&quot;')
						.replace(/'/g, '&apos;')
				return new Response(
					`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/privacy'].map((path) => `<url><loc>${escape(site.url + path)}</loc></url>`).join('')}</urlset>`,
					{ headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
				)
			},
		},
	},
})

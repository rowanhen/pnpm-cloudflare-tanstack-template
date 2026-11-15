import { createFileRoute } from '@tanstack/react-router'
import { site, indexable } from '../lib/seo'
import { supportedLocales } from '../lib/locale'

const escapeXml = (value: string) =>
	value.replace(
		/[<>&"']/g,
		(char) =>
			({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char] ?? char,
	)

export const Route = createFileRoute('/sitemap.xml')({
	server: {
		handlers: {
			GET: () => {
				const urls = (indexable ? supportedLocales : [])
					.flatMap((locale) => [
						`/${locale}`,
						`/${locale}/guides/getting-started`,
						`/${locale}/privacy`,
					])
					.map((path) => `<url><loc>${escapeXml(new URL(path, site.url).href)}</loc></url>`)
					.join('')
				return new Response(
					`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
					{ headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
				)
			},
		},
	},
})

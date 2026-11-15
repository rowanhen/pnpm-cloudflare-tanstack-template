import { createFileRoute } from '@tanstack/react-router'
import { site } from '../lib/seo'
import { defaultLocale } from '../lib/locale'

export const Route = createFileRoute('/llms.txt')({
	server: {
		handlers: {
			GET: () => {
				const body = [
					`# ${site.name}`,
					`> ${site.description}`,
					'## Pages',
					`- [Homepage](${site.url}/${defaultLocale}/index.md)`,
					`- [Getting started](${site.url}/${defaultLocale}/guides/getting-started)`,
					`- [Privacy](${site.url}/${defaultLocale}/privacy)`,
				].join('\n\n')
				return new Response(`${body}\n`, {
					headers: { 'Content-Type': 'text/plain; charset=utf-8' },
				})
			},
		},
	},
})

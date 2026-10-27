import { createFileRoute } from '@tanstack/react-router'
import { pages } from '../publishing/catalog.server'
import { renderLlms } from '../publishing/markdown'
import { site } from '../lib/seo'

export const Route = createFileRoute('/llms.txt')({
	server: {
		handlers: {
			GET: () =>
				new Response(renderLlms(pages, site), {
					headers: { 'Content-Type': 'text/plain; charset=utf-8' },
				}),
		},
	},
})

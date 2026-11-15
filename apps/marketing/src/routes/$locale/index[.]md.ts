import { createFileRoute } from '@tanstack/react-router'
import { t } from '@workspace/shared/lib/i18n'
import { isSupportedLocale } from '../../lib/locale'
import { site } from '../../lib/seo'

type HomeCopy = (typeof import('./-copy/en'))['default']
const translations = import.meta.glob<{ default: HomeCopy }>('./-copy/*.ts')

export const Route = createFileRoute('/$locale/index.md')({
	server: {
		handlers: {
			GET: async ({ params }) => {
				if (!isSupportedLocale(params.locale)) return new Response('Not found', { status: 404 })
				const copy = await t(translations, params.locale)
				const markdown = [
					`# ${copy.title} ${copy.accent}`,
					copy.intro,
					`## ${copy.includedTitle}`,
					...copy.features.map((feature) => `### ${feature.title}\n\n${feature.description}`),
					`## ${copy.docsLabel}`,
					`[${copy.gettingStarted}](${site.url}/${params.locale}/guides/getting-started)`,
				].join('\n\n')
				return new Response(`${markdown}\n`, {
					headers: {
						'Content-Type': 'text/markdown; charset=utf-8',
						'X-Robots-Tag': 'noindex',
					},
				})
			},
		},
	},
})

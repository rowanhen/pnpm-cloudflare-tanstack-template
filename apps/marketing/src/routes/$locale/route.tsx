import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'
import { t } from '@workspace/shared/lib/i18n'
import { isSupportedLocale } from '../../lib/locale'

type ChromeCopy = (typeof import('../-components/-copy/en'))['default']
const translations = import.meta.glob<{ default: ChromeCopy }>('../-components/-copy/*.ts')

export const Route = createFileRoute('/$locale')({
	beforeLoad: ({ params }) => {
		if (!isSupportedLocale(params.locale)) throw notFound()
	},
	loader: ({ params }) => t(translations, params.locale),
	component: Outlet,
})

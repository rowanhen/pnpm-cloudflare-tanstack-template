import { useRouterState } from '@tanstack/react-router'
import { LinkButton, PageState } from '@workspace/shared'
import { defaultLocale, isSupportedLocale } from '../../lib/locale'

export function NotFoundScreen() {
	const pathname = useRouterState({ select: (state) => state.location.pathname })
	const requestedLocale = pathname.split('/')[1] ?? ''
	const locale = isSupportedLocale(requestedLocale) ? requestedLocale : defaultLocale
	return (
		<PageState kind="not-found" title="Page not found">
			<LinkButton variant="primary" aria-label="Back to home" to="/$locale" params={{ locale }}>
				Back to home
			</LinkButton>
		</PageState>
	)
}

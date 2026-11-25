import { useRouterState } from '@tanstack/react-router'
import { reportError } from '@workspace/observability/browser'
import { Button } from '@leitware/composables'
import { LinkButton, PageState } from '@workspace/shared'
import { useEffect } from 'react'
import { defaultLocale, isSupportedLocale } from '../../lib/locale'

export function ErrorScreen({ error, retry }: { error?: unknown; retry?: () => void }) {
	const pathname = useRouterState({ select: (state) => state.location.pathname })
	const requestedLocale = pathname.split('/')[1] ?? ''
	const locale = isSupportedLocale(requestedLocale) ? requestedLocale : defaultLocale
	useEffect(() => {
		if (error) reportError(error, 'route')
	}, [error])
	return (
		<PageState kind="error" title="Couldn't load this page">
			<Button variant="primary" onClick={retry ?? (() => window.location.reload())}>
				Try again
			</Button>
			<LinkButton variant="default" aria-label="Back to home" to="/$locale" params={{ locale }}>
				Back to home
			</LinkButton>
		</PageState>
	)
}

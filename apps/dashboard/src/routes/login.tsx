import { AppShell, Button, Stack, Alert, appTitle, Typography } from '@workspace/shared'
import { client } from '../lib/api'
import { useEffect, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { observedFetch } from '@workspace/observability/browser'
import { getSession } from '../lib/session'
import { loginSearch, loginReturnPath, signInPath } from '../lib/login'

export const Route = createFileRoute('/login')({
	validateSearch: loginSearch,
	beforeLoad: async ({ search }) => {
		if (await getSession()) throw redirect({ href: loginReturnPath(search) })
	},
	head: () => ({ meta: [{ title: appTitle('Sign in') }] }),
	component: LoginPage,
})
function LoginPage() {
	const search = Route.useSearch()
	const [ready, setReady] = useState(false)
	const [googleEnabled, setGoogleEnabled] = useState(false)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const callbackError =
		search.error === 'cancelled'
			? 'Sign-in was cancelled. Try again when you’re ready.'
			: search.error
				? 'Google sign-in could not be completed. Please try again.'
				: ''
	useEffect(() => {
		client
			.get('config')
			.then((data) => {
				setGoogleEnabled(data.googleEnabled)
				setReady(true)
			})
			.catch(() => setError('Could not load sign-in settings.'))
	}, [])
	async function signIn() {
		setBusy(true)
		setError('')
		try {
			const returnPath = loginReturnPath(search)
			const destination = new URL(returnPath, window.location.origin)
			const response = await observedFetch('/api/auth/sign-in/social', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider: 'google',
					callbackURL: destination.href,
					errorCallbackURL:
						window.location.origin +
						signInPath(destination.pathname, Object.fromEntries(destination.searchParams)),
				}),
			})
			const data = (await response.json()) as { url?: string; message?: string }
			if (!response.ok || !data.url)
				throw new Error(data.message ?? 'Unable to start Google sign-in')
			window.location.assign(data.url)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Sign-in failed')
			setBusy(false)
		}
	}
	return (
		<AppShell title="Sign in">
			<div className="max-w-sm">
				<Stack gap={4}>
					<Button className="w-full" disabled={!ready || !googleEnabled || busy} onClick={signIn}>
						{busy ? 'Redirecting…' : 'Continue with Google'}
					</Button>
					{ready && !googleEnabled && (
						<Typography as="p" variant="body-200">
							Google sign-in is unavailable.
						</Typography>
					)}
					{(error || (!busy && callbackError)) && (
						<Alert type="negative">{error || callbackError}</Alert>
					)}
				</Stack>
			</div>
		</AppShell>
	)
}

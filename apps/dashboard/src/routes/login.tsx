import { useEffect, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@workspace/shared'
import { getSession } from '../lib/session'

export const Route = createFileRoute('/login')({
	beforeLoad: async () => {
		if (await getSession()) throw redirect({ to: '/' })
	},
	component: LoginPage,
})
function LoginPage() {
	const [ready, setReady] = useState(false)
	const [googleEnabled, setGoogleEnabled] = useState(false)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	useEffect(() => {
		fetch('/api/config')
			.then((response) => response.json())
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
			const response = await fetch('/api/auth/sign-in/social', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider: 'google',
					callbackURL: window.location.origin + '/',
					errorCallbackURL: window.location.origin + '/login',
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
		<AppShell
			title="Welcome back"
			description="Sign in to your workspace. Your records, files and API keys stay private to your account."
			accent="#38bdf8"
		>
			<button disabled={!ready || !googleEnabled || busy} onClick={signIn}>
				{busy ? 'Redirecting…' : 'Continue with Google'}
			</button>
			{ready && !googleEnabled && (
				<p>Google sign-in is not configured yet. Follow the Google OAuth setup in the README.</p>
			)}
			{error && <p role="alert">{error}</p>}
		</AppShell>
	)
}

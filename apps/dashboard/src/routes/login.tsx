import { client } from '../lib/api'
import { useEffect, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell, Button, Card, Stack, Alert } from '@workspace/shared'
import { getSession } from '../lib/session'

export const Route = createFileRoute('/login')({
	validateSearch: (search: Record<string, unknown>): { next?: 'checkout' } => ({
		next: search.next === 'checkout' ? 'checkout' : undefined,
	}),
	beforeLoad: async ({ search }) => {
		if (await getSession()) throw redirect({ to: search.next === 'checkout' ? '/checkout' : '/' })
	},
	component: LoginPage,
})
function LoginPage() {
	const { next } = Route.useSearch()
	const [ready, setReady] = useState(false)
	const [googleEnabled, setGoogleEnabled] = useState(false)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
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
			const response = await fetch('/api/auth/sign-in/social', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider: 'google',
					callbackURL: window.location.origin + (next === 'checkout' ? '/checkout' : '/'),
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
		<AppShell title="Sign in">
			<Card className="max-w-md">
				<Stack gap={4}>
					<Button className="w-full" disabled={!ready || !googleEnabled || busy} onClick={signIn}>
						{busy ? 'Redirecting…' : 'Continue with Google'}
					</Button>
					{ready && !googleEnabled && <p>Google sign-in is unavailable.</p>}
					{error && <Alert type="negative">{error}</Alert>}
				</Stack>
			</Card>
		</AppShell>
	)
}

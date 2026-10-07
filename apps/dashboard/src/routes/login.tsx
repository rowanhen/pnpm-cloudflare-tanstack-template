import { useEffect, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
	AppShell,
	Button,
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	Alert,
	AlertDescription,
} from '@workspace/shared'
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
		<AppShell
			title="Welcome back"
			description="Sign in to your workspace. Your records, files and API keys stay private to your account."
		>
			<Card className="max-w-md">
				<CardHeader>
					<CardTitle>Your next idea starts here.</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<Button className="w-full" disabled={!ready || !googleEnabled || busy} onClick={signIn}>
						{busy ? 'Redirecting…' : 'Continue with Google'}
					</Button>
					{ready && !googleEnabled && (
						<p>
							Google sign-in is not configured yet. Follow the Google OAuth setup in the README.
						</p>
					)}
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>
		</AppShell>
	)
}

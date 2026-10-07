import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useHydrated } from '@workspace/shared'

export function useWaitlist() {
	const hydrated = useHydrated()
	const navigate = useNavigate()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	async function submit(form: HTMLFormElement) {
		setBusy(true)
		setError('')
		const fields = new FormData(form)
		try {
			const response = await fetch('/api/waitlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: fields.get('name'),
					email: fields.get('email'),
					website: fields.get('website'),
					consent: fields.get('consent') === 'on',
				}),
			})
			const data = (await response.json()) as { error?: string }
			if (!response.ok)
				throw new Error(data.error ?? 'Could not save your signup. Please try again.')
			await navigate({ to: '/waitlist/success' })
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Unable to join the waitlist.')
			setBusy(false)
		}
	}
	return { disabled: !hydrated || busy, busy, error, submit }
}

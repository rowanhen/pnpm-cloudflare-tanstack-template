import { track } from '@workspace/observability/browser'
import { joinWaitlist } from '../generated/waitlist'
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
			if (fields.get('consent') !== 'on') throw new Error('Please agree to join the waitlist')
			await joinWaitlist({
				name: fields.get('name')?.toString() ?? '',
				email: fields.get('email')?.toString() ?? '',
				website: fields.get('website')?.toString() ?? '',
				consent: true,
			})
			track('waitlist.joined', {})
			await navigate({ to: '/waitlist/success' })
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Unable to join the waitlist.')
			setBusy(false)
		}
	}
	return { disabled: !hydrated || busy, busy, error, submit }
}

import { useNavigate } from '@tanstack/react-router'
import { Alert, Button, Skeleton, Input, Label, Stack } from '@workspace/shared'
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
	CheckoutElementsProvider,
	PaymentElement,
	useCheckoutElements,
} from '@stripe/react-stripe-js/checkout'

const clients = new Map<string, ReturnType<typeof loadStripe>>()
function stripeClient(key: string) {
	const existing = clients.get(key)
	if (existing) return existing
	const client = loadStripe(key)
	clients.set(key, client)
	return client
}
export default function PaymentForm({
	publishableKey,
	clientSecret,
	sessionId,
	collectEmail = false,
	submitLabel,
	onComplete,
	onBack,
}: {
	publishableKey: string
	clientSecret: string
	sessionId: string
	collectEmail?: boolean
	submitLabel?: string
	onComplete?: () => void | Promise<void>
	onBack?: () => void
}) {
	const [appearance] = useState(() => {
		if (typeof document === 'undefined') return undefined
		const theme = getComputedStyle(document.documentElement)
		return {
			colorPrimary: theme.getPropertyValue('--bg-fill-primary').trim(),
			colorText: theme.getPropertyValue('--text-default').trim(),
			colorBackground: theme.getPropertyValue('--bg-surface-default').trim(),
			fontFamily: theme.fontFamily,
			borderRadius: theme.getPropertyValue('--radius').trim(),
		}
	})

	return (
		<CheckoutElementsProvider
			stripe={stripeClient(publishableKey)}
			options={{
				clientSecret,
				elementsOptions: {
					appearance: {
						theme: 'stripe',
						variables: appearance,
					},
				},
			}}
		>
			<Form
				sessionId={sessionId}
				collectEmail={collectEmail}
				submitLabel={submitLabel}
				onComplete={onComplete}
				onBack={onBack}
			/>
		</CheckoutElementsProvider>
	)
}
function Form({
	sessionId,
	collectEmail,
	submitLabel,
	onComplete,
	onBack,
}: {
	sessionId: string
	collectEmail: boolean
	submitLabel?: string
	onComplete?: () => void | Promise<void>
	onBack?: () => void
}) {
	const navigate = useNavigate()
	const checkout = useCheckoutElements()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const [email, setEmail] = useState('')
	const back = onBack && (
		<Button type="button" variant="link" disabled={busy} onClick={onBack}>
			Back to products
		</Button>
	)
	if (checkout.type === 'loading')
		return (
			<Stack gap={5}>
				<Skeleton className="h-60" aria-label="Loading payment form" />
				{back}
			</Stack>
		)
	if (checkout.type === 'error')
		return (
			<Stack gap={5}>
				<Alert type="negative">
					Unable to load the payment form. Please refresh and try again.
				</Alert>
				{back}
			</Stack>
		)
	return (
		<form
			className="space-y-6"
			onSubmit={async (event) => {
				event.preventDefault()
				setBusy(true)
				setError('')
				try {
					const result = await checkout.checkout.confirm({
						redirect: 'if_required',
						...(collectEmail ? { email: email.trim() } : {}),
					})
					if (result.type === 'error') {
						setError(result.error.message)
						setBusy(false)
					} else if (onComplete) await onComplete()
					else await navigate({ to: '/checkout/success', search: { session_id: sessionId } })
				} catch {
					setError('Payment could not be confirmed. Please try again.')
					setBusy(false)
				}
			}}
		>
			{collectEmail && (
				<Stack gap={2}>
					<Label htmlFor="checkout-email">Email</Label>
					<Input
						id="checkout-email"
						type="email"
						autoComplete="email"
						required
						maxLength={254}
						disabled={busy}
						value={email}
						onChange={(event) => setEmail(event.target.value)}
					/>
				</Stack>
			)}
			<PaymentElement options={{ layout: 'tabs', wallets: { link: 'never' } }} />
			{error && <Alert type="negative">{error}</Alert>}
			<Button className="w-full" size="lg" disabled={busy} type="submit">
				{busy ? 'Confirming…' : (submitLabel ?? `Pay ${checkout.checkout.total.total.amount}`)}
			</Button>
			{back}
		</form>
	)
}

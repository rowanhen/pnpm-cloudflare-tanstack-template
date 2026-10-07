import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
	CheckoutElementsProvider,
	PaymentElement,
	useCheckoutElements,
} from '@stripe/react-stripe-js/checkout'
import { Alert, AlertDescription, Button, Skeleton } from '@workspace/shared'

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
}: {
	publishableKey: string
	clientSecret: string
	sessionId: string
}) {
	return (
		<CheckoutElementsProvider
			stripe={stripeClient(publishableKey)}
			options={{
				clientSecret,
				elementsOptions: {
					appearance: {
						theme: 'stripe',
						variables: {
							colorPrimary: '#185c43',
							colorText: '#172c29',
							borderRadius: '8px',
							fontFamily: 'system-ui, sans-serif',
						},
					},
				},
			}}
		>
			<Form sessionId={sessionId} />
		</CheckoutElementsProvider>
	)
}
function Form({ sessionId }: { sessionId: string }) {
	const checkout = useCheckoutElements()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	if (checkout.type === 'loading')
		return <Skeleton className="h-60" aria-label="Loading payment form" />
	if (checkout.type === 'error')
		return (
			<Alert variant="destructive">
				<AlertDescription>
					Unable to load the payment form. Please refresh and try again.
				</AlertDescription>
			</Alert>
		)
	return (
		<form
			className="space-y-6"
			onSubmit={async (event) => {
				event.preventDefault()
				setBusy(true)
				setError('')
				try {
					const result = await checkout.checkout.confirm()
					if (result.type === 'error') {
						setError(result.error.message)
						setBusy(false)
					} else
						window.location.assign(`/checkout/success?session_id=${encodeURIComponent(sessionId)}`)
				} catch {
					setError('Payment could not be confirmed. Please try again.')
					setBusy(false)
				}
			}}
		>
			<PaymentElement options={{ layout: 'tabs' }} />
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			<Button className="w-full" size="lg" disabled={busy} type="submit">
				{busy ? 'Confirming…' : `Pay ${checkout.checkout.total.total.amount}`}
			</Button>
			<p className="text-center text-xs leading-5 text-muted-foreground">
				Test mode · No real money is collected. Payment details are handled securely by Stripe.
			</p>
		</form>
	)
}

import { LinkButton, Button, PageState, appTitle } from '@workspace/shared'
import { createFileRoute } from '@tanstack/react-router'
import { usePaymentStatus } from '../hooks/use-payment-status'
import { checkoutProofKey } from '../lib/checkout-session'
import { checkStorefrontCheckout } from '../generated/storefront'
import { paymentView } from '../lib/payment-view'
import { checkoutSessionId } from '../lib/login'
export const Route = createFileRoute('/checkout/complete')({
	validateSearch: (search: Record<string, unknown>) => ({
		session_id: checkoutSessionId(search.session_id),
	}),
	head: () => ({ meta: [{ title: appTitle('Payment') }] }),
	component: Complete,
})
function Complete() {
	const { session_id } = Route.useSearch()
	const status = usePaymentStatus(
		'storefront-status',
		session_id,
		async () => {
			const token = sessionStorage.getItem(checkoutProofKey(session_id))
			if (!token) throw new Error('Checkout not found in this browser')
			return (await checkStorefrontCheckout({ sessionId: session_id, token })).data
		},
		(data) => data.status === 'pending',
	)
	const view = paymentView(
		!session_id
			? 'missing'
			: status.isError
				? 'error'
				: status.isPending
					? 'checking'
					: status.data.status,
		status.data?.mode,
	)
	const complete = view.kind === 'success'
	return (
		<PageState {...view}>
			{!complete && !!session_id && (
				<Button onClick={() => void status.refetch()} disabled={status.isFetching}>
					Check again
				</Button>
			)}
			<LinkButton
				variant={complete ? 'default' : 'outline'}
				aria-label="Back to products"
				to="/checkout"
			>
				Back to products
			</LinkButton>
		</PageState>
	)
}

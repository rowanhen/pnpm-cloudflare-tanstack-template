import { createFileRoute } from '@tanstack/react-router'
import { Button, PageState } from '@workspace/shared'
import { money, useOrderStatus } from '../hooks/use-checkout'
export const Route = createFileRoute('/checkout/success')({
	validateSearch: (search: Record<string, unknown>) => ({
		session_id:
			typeof search.session_id === 'string' && /^cs_test_[A-Za-z0-9]+$/.test(search.session_id)
				? search.session_id
				: '',
	}),
	head: () => ({ meta: [{ title: 'Your order — Idea Starter' }] }),
	component: CheckoutSuccess,
})
function CheckoutSuccess() {
	const { session_id } = Route.useSearch()
	const status = useOrderStatus(session_id)
	if (!session_id || status.isError)
		return (
			<PageState
				kind="error"
				title="We couldn't find that order."
				description="Open checkout from your workspace, or try checking this order again."
			>
				{session_id && <Button onClick={() => void status.refetch()}>Check again</Button>}
				<Button variant="outline" asChild>
					<a href="/checkout">Back to checkout</a>
				</Button>
			</PageState>
		)
	if (status.isPending)
		return (
			<PageState
				kind="loading"
				title="Checking your payment…"
				description="We're confirming the order with Stripe."
			/>
		)
	const order = status.data.order
	if (order.status === 'paid')
		return (
			<PageState
				kind="success"
				title="Payment successful."
				description={`Your test payment of ${money(order.amount, order.currency)} is confirmed. Your order has been saved to your account.`}
			>
				<p className="w-full break-all font-mono text-xs text-muted-foreground">Order {order.id}</p>
				<Button asChild>
					<a href="/">Back to workspace</a>
				</Button>
			</PageState>
		)
	if (order.status === 'expired')
		return (
			<PageState
				kind="error"
				title="This checkout has expired."
				description="No payment was confirmed for this order. Start a fresh checkout whenever you're ready."
			>
				<Button asChild>
					<a href="/checkout">Start a new checkout</a>
				</Button>
			</PageState>
		)
	return (
		<PageState
			kind="loading"
			title={
				status.data.checkoutStatus === 'open'
					? 'Your checkout is incomplete.'
					: 'Your payment is processing.'
			}
			description="We haven't confirmed a payment yet. You can check the status again or return to checkout."
		>
			<Button onClick={() => void status.refetch()} disabled={status.isFetching}>
				Check payment status
			</Button>
			<Button variant="outline" asChild>
				<a href="/checkout">Back to checkout</a>
			</Button>
		</PageState>
	)
}

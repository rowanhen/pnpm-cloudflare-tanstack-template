import { LinkButton, Button, PageState, appTitle } from '@workspace/shared'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { checkoutSessionId, signInPath } from '../lib/login'
import { getSession } from '../lib/session'
import { paymentView } from '../lib/payment-view'
import { money, useOrderStatus } from '../hooks/use-checkout'
export const Route = createFileRoute('/checkout/success')({
	beforeLoad: async ({ location }) => {
		if (!(await getSession()))
			throw redirect({ href: signInPath(location.pathname, location.search) })
	},
	validateSearch: (search: Record<string, unknown>) => ({
		session_id: checkoutSessionId(search.session_id),
	}),
	head: () => ({ meta: [{ title: appTitle('Your order') }] }),
	component: CheckoutSuccess,
})
function CheckoutSuccess() {
	const { session_id } = Route.useSearch()
	const status = useOrderStatus(session_id)
	if (!session_id || status.isError)
		return (
			<PageState kind="error" title="We couldn't find that order.">
				{session_id && <Button onClick={() => void status.refetch()}>Check again</Button>}
				<LinkButton variant="outline" aria-label="Back to checkout" to="/credits">
					Back to checkout
				</LinkButton>
			</PageState>
		)
	if (status.isPending) return <PageState {...paymentView('checking')} />
	const order = status.data.order
	if (order.status === 'paid')
		return (
			<PageState
				{...paymentView('paid')}
				description={`${order.credits.toLocaleString('en-GB')} credits added · ${money(order.amount, order.currency)}.`}
			>
				<LinkButton aria-label="Back to workspace" to="/">
					Back to workspace
				</LinkButton>
			</PageState>
		)
	if (order.status === 'expired')
		return (
			<PageState {...paymentView('expired')} description="No payment was confirmed.">
				<LinkButton aria-label="Start a new checkout" to="/credits">
					Start a new checkout
				</LinkButton>
			</PageState>
		)
	return (
		<PageState {...paymentView(status.data.checkoutStatus === 'open' ? 'open' : 'pending')}>
			<Button onClick={() => void status.refetch()} disabled={status.isFetching}>
				Check payment status
			</Button>
			<LinkButton variant="outline" aria-label="Back to checkout" to="/credits">
				Back to checkout
			</LinkButton>
		</PageState>
	)
}

import { Link, createFileRoute, redirect } from '@tanstack/react-router'

import { Button, PageState, appTitle } from '@workspace/shared'

import { checkoutSessionId, signInPath } from '../lib/login'
import { getSession } from '../lib/session'
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
				<Button
					variant="outline"
					{...{ nativeButton: false }}
					render={<Link aria-label="Back to checkout" role="link" to="/credits" />}
				>
					Back to checkout
				</Button>
			</PageState>
		)
	if (status.isPending) return <PageState kind="loading" title="Checking your payment…" />
	const order = status.data.order
	if (order.status === 'paid')
		return (
			<PageState
				kind="success"
				title="Payment successful."
				description={`${order.credits.toLocaleString('en-GB')} credits added · ${money(order.amount, order.currency)}.`}
			>
				<Button
					{...{ nativeButton: false }}
					render={<Link aria-label="Back to workspace" role="link" to="/" />}
				>
					Back to workspace
				</Button>
			</PageState>
		)
	if (order.status === 'expired')
		return (
			<PageState
				kind="error"
				title="This checkout has expired."
				description="No payment was confirmed."
			>
				<Button
					{...{ nativeButton: false }}
					render={<Link aria-label="Start a new checkout" role="link" to="/credits" />}
				>
					Start a new checkout
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
		>
			<Button onClick={() => void status.refetch()} disabled={status.isFetching}>
				Check payment status
			</Button>
			<Button
				variant="outline"
				{...{ nativeButton: false }}
				render={<Link aria-label="Back to checkout" role="link" to="/credits" />}
			>
				Back to checkout
			</Button>
		</PageState>
	)
}

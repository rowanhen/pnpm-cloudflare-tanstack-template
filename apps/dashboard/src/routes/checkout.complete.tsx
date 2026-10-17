import { Link, createFileRoute } from '@tanstack/react-router'
import { Button, PageState, appTitle, useHydrated } from '@workspace/shared'
import { useQuery } from '@tanstack/react-query'
import { checkStorefrontCheckout } from '../generated/storefront'
import { checkoutSessionId } from '../lib/login'
export const Route = createFileRoute('/checkout/complete')({
	validateSearch: (search: Record<string, unknown>) => ({
		session_id: checkoutSessionId(search.session_id),
	}),
	head: () => ({ meta: [{ title: appTitle('Test payment') }] }),
	component: Complete,
})
function Complete() {
	const { session_id } = Route.useSearch()
	const hydrated = useHydrated()
	const status = useQuery({
		queryKey: ['storefront-status', session_id],
		enabled: hydrated && !!session_id,
		retry: false,
		queryFn: async () => {
			const token = sessionStorage.getItem(`storefront:${session_id}`)
			if (!token) throw new Error('Checkout not found in this browser')
			return (await checkStorefrontCheckout({ sessionId: session_id, token })).data
		},
		refetchInterval: (query) =>
			query.state.data?.status === 'pending' && query.state.dataUpdateCount < 12 ? 2500 : false,
	})
	const complete = status.data?.status === 'paid'
	const title =
		!session_id || status.isError
			? "We couldn't find that checkout."
			: status.isPending
				? 'Checking your payment…'
				: complete
					? status.data.mode === 'subscription'
						? 'Test subscription started.'
						: 'Test payment successful.'
					: status.data.status === 'expired'
						? 'This checkout has expired.'
						: status.data.status === 'open'
							? 'Checkout is incomplete.'
							: 'Your test payment is processing.'
	return (
		<PageState
			kind={
				complete
					? 'success'
					: !session_id || status.isError || status.data?.status === 'expired'
						? 'error'
						: 'loading'
			}
			title={title}
			description={complete ? 'No real charge was made.' : undefined}
		>
			{!complete && !!session_id && (
				<Button onClick={() => void status.refetch()} disabled={status.isFetching}>
					Check again
				</Button>
			)}
			<Button
				variant={complete ? 'default' : 'outline'}
				{...{ nativeButton: false }}
				render={
					<Link
						role="link"
						aria-label="Back to products"
						to="/checkout"
						search={{ cancelled: undefined }}
					/>
				}
			>
				Back to products
			</Button>
		</PageState>
	)
}

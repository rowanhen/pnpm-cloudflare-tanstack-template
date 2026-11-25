import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@leitware/composables'
import { LinkButton, PageState } from '@workspace/shared'
import { usePaymentStatus } from '@workspace/shared/hooks/use-payment-status'
import { checkoutSessionId } from '@workspace/shared/lib/checkout-session-id'
import { paymentView } from '@workspace/shared/lib/payment-view'
import { checkoutProofKey } from '../../../lib/checkout-session'
import { seo, site } from '../../../lib/seo'
import { checkStorefrontCheckout } from '../../../generated/storefront'
import { MarketingFooter } from '../../-components/footer'
import { MarketingHeader } from '../../-components/header'

export const Route = createFileRoute('/$locale/checkout/complete')({
	validateSearch: (search: Record<string, unknown>) => ({
		session_id: checkoutSessionId(search.session_id),
	}),
	head: ({ params }) =>
		seo(`/${params.locale}/checkout/complete`, `Payment — ${site.name}`, site.description, true),
	component: Complete,
})

function Complete() {
	const { session_id } = Route.useSearch()
	const { locale } = Route.useParams()
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
		<div className="min-h-svh">
			<div className="page-container">
				<MarketingHeader />
				<main className="py-16">
					<PageState {...view}>
						{!complete && !!session_id && (
							<Button
								variant="primary"
								onClick={() => void status.refetch()}
								disabled={status.isFetching}
							>
								Check again
							</Button>
						)}
						<LinkButton
							variant={complete ? 'primary' : 'default'}
							aria-label="Back to products"
							to="/$locale/checkout"
							params={{ locale }}
						>
							Back to products
						</LinkButton>
					</PageState>
				</main>
				<MarketingFooter />
			</div>
		</div>
	)
}

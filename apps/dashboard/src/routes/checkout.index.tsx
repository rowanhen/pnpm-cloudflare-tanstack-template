import {
	LinkButton,
	Alert,
	AppShell,
	Button,
	PageSection,
	Skeleton,
	Stack,
	Typography,
	appTitle,
	useHydrated,
} from '@workspace/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { useGetStorefront } from '../generated/storefront'
import { money } from '../hooks/use-checkout'
import { useStorefrontCheckout } from '../hooks/use-storefront-checkout'
const PaymentForm = lazy(() => import('../components/payment-form'))
export const Route = createFileRoute('/checkout/')({
	head: () => ({ meta: [{ title: appTitle('Checkout') }] }),
	component: Storefront,
})
function Storefront() {
	const hydrated = useHydrated()
	const navigate = useNavigate()
	const catalogue = useGetStorefront({ query: { enabled: hydrated, retry: false } })
	const checkout = useStorefrontCheckout()
	const state = checkout.state
	return (
		<AppShell title="Checkout">
			{state.status === 'ready' ? (
				<Stack gap={8}>
					<PageSection title={state.product.name}>
						<Typography variant="heading-400">
							{money(state.product.amount, state.product.currency)}
							{state.product.interval ? ` / ${state.product.interval}` : ''}
						</Typography>
					</PageSection>
					<PageSection title="Payment details">
						<Suspense fallback={<Skeleton className="h-80" aria-label="Loading payment form" />}>
							<PaymentForm
								key={state.session.sessionId}
								publishableKey={state.session.publishableKey}
								clientSecret={state.session.clientSecret}
								sessionId={state.session.sessionId}
								collectEmail
								submitLabel={
									state.product.id === 'subscription'
										? 'Subscribe'
										: `Pay ${money(state.product.amount, state.product.currency)}`
								}
								onBack={checkout.back}
								onComplete={() =>
									navigate({
										to: '/checkout/complete',
										search: { session_id: state.session.sessionId },
									})
								}
							/>
						</Suspense>
					</PageSection>
				</Stack>
			) : catalogue.isPending ? (
				<Skeleton className="h-64" aria-label="Loading products" />
			) : catalogue.isError ? (
				<PageSection title="Checkout is unavailable.">
					<Button variant="outline" onClick={() => void catalogue.refetch()}>
						Try again
					</Button>
				</PageSection>
			) : !catalogue.data.data.enabled ? (
				<PageSection title="Checkout isn't configured.">
					<Button variant="outline" onClick={() => void catalogue.refetch()}>
						Check again
					</Button>
				</PageSection>
			) : (
				<Stack gap={8}>
					{catalogue.data.data.products.map((item) => (
						<PageSection key={item.id} title={item.name}>
							<Stack direction="horizontal" align="center" justify="between" wrap gap={5}>
								<Typography variant="heading-400">
									{money(item.amount, item.currency)}
									{item.interval ? ` / ${item.interval}` : ''}
								</Typography>
								<Button disabled={state.status === 'creating'} onClick={() => checkout.open(item)}>
									{state.status === 'creating' && state.product.id === item.id
										? 'Opening checkout…'
										: item.id === 'subscription'
											? 'Subscribe'
											: 'Buy'}
								</Button>
							</Stack>
						</PageSection>
					))}
				</Stack>
			)}
			{state.status === 'error' && (
				<Alert type="negative">Couldn't open checkout. Please try again.</Alert>
			)}
			<LinkButton variant="link" aria-label="Buy workspace credits" to="/credits">
				Buy workspace credits
			</LinkButton>
		</AppShell>
	)
}

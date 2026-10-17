import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
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
import { useRef, lazy, Suspense } from 'react'
import { useGetStorefront, useCreateStorefrontCheckout } from '../generated/storefront'
import { money } from '../hooks/use-checkout'
const PaymentForm = lazy(() => import('../components/payment-form'))
export const Route = createFileRoute('/checkout/')({
	head: () => ({ meta: [{ title: appTitle('Checkout') }] }),
	component: Storefront,
})
function Storefront() {
	const hydrated = useHydrated()
	const navigate = useNavigate()
	const catalogue = useGetStorefront({ query: { enabled: hydrated, retry: false } })
	const attempts = useRef(new Map<string, { requestId: string; token: string }>())
	const checkout = useCreateStorefrontCheckout({
		mutation: {
			onSuccess: ({ data }, variables) => {
				sessionStorage.setItem(`storefront:${data.sessionId}`, variables.data.token)
			},
		},
	})
	const selected = catalogue.data?.data.products.find(
		(item) => item.id === checkout.variables?.data.product,
	)
	return (
		<AppShell title="Checkout">
			{checkout.data && selected ? (
				<Stack gap={8}>
					<PageSection title={selected.name}>
						<Typography variant="heading-400">
							{money(selected.amount, selected.currency)}
							{selected.interval ? ` / ${selected.interval}` : ''}
						</Typography>
					</PageSection>
					<PageSection title="Payment details">
						<Suspense fallback={<Skeleton className="h-80" aria-label="Loading payment form" />}>
							<PaymentForm
								key={checkout.data.data.sessionId}
								publishableKey={checkout.data.data.publishableKey}
								clientSecret={checkout.data.data.clientSecret}
								sessionId={checkout.data.data.sessionId}
								collectEmail
								submitLabel={
									selected.id === 'subscription'
										? 'Subscribe'
										: `Pay ${money(selected.amount, selected.currency)}`
								}
								onBack={() => checkout.reset()}
								onComplete={() =>
									navigate({
										to: '/checkout/complete',
										search: { session_id: checkout.data.data.sessionId },
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
								<Button
									disabled={checkout.isPending}
									onClick={() => {
										let attempt = attempts.current.get(item.id)
										if (!attempt) {
											attempt = { requestId: crypto.randomUUID(), token: crypto.randomUUID() }
											attempts.current.set(item.id, attempt)
										}
										checkout.mutate({ data: { product: item.id, ...attempt } })
									}}
								>
									{checkout.isPending && checkout.variables?.data.product === item.id
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
			{checkout.isError && <Alert type="negative">Couldn't open checkout. Please try again.</Alert>}
			<Button
				variant="link"
				{...{ nativeButton: false }}
				render={<Link role="link" aria-label="Buy workspace credits" to="/credits" />}
			>
				Buy workspace credits
			</Button>
		</AppShell>
	)
}

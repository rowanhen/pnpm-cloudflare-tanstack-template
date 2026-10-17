import { Link, createFileRoute } from '@tanstack/react-router'
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
import { useRef } from 'react'
import { useGetStorefront, useCreateStorefrontCheckout } from '../generated/storefront'
import { money } from '../hooks/use-checkout'
export const Route = createFileRoute('/checkout/')({
	validateSearch: (search: Record<string, unknown>) => ({
		cancelled: search.cancelled === true || search.cancelled === 'true' ? true : undefined,
	}),
	head: () => ({ meta: [{ title: appTitle('Test checkout') }] }),
	component: Storefront,
})
function Storefront() {
	const hydrated = useHydrated()
	const { cancelled } = Route.useSearch()
	const catalogue = useGetStorefront({ query: { enabled: hydrated, retry: false } })
	const attempts = useRef(new Map<string, { requestId: string; token: string }>())
	const checkout = useCreateStorefrontCheckout({
		mutation: {
			onSuccess: ({ data }, variables) => {
				sessionStorage.setItem(`storefront:${data.sessionId}`, variables.data.token)
				window.location.assign(data.url)
			},
		},
	})
	return (
		<AppShell title="Test checkout" description="No sign-in. No real charges.">
			{cancelled && <Alert>Checkout cancelled.</Alert>}
			{catalogue.isPending ? (
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
					<Typography as="p" variant="caption-100" className="text-content-secondary">
						Test card: 4242 4242 4242 4242 · Any future expiry and CVC.
					</Typography>
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

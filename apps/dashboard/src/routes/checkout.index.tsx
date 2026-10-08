import { lazy, Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
	AppShell,
	appTitle,
	Alert,
	Badge,
	Button,
	Card,
	Skeleton,
	Stack,
	Typography,
} from '@workspace/shared'
import { money, useCheckoutSession } from '../hooks/use-checkout'
const PaymentForm = lazy(() => import('../components/payment-form'))
export const Route = createFileRoute('/checkout/')({
	head: () => ({ meta: [{ title: appTitle('Test checkout') }] }),
	component: CheckoutPage,
})
function CheckoutPage() {
	const { config, create } = useCheckoutSession()
	return (
		<AppShell title="Checkout">
			<Button variant="link" className="px-0" asChild>
				<a href="/">← Back to workspace</a>
			</Button>
			{config.isPending ? (
				<Skeleton className="h-80 max-w-2xl" aria-label="Loading checkout" />
			) : config.isError ? (
				<Card className="max-w-lg" title="Checkout is unavailable.">
					<Button variant="outline" onClick={() => void config.refetch()}>
						Try again
					</Button>
				</Card>
			) : (
				<div className="grid items-start gap-8 lg:grid-cols-[.8fr_1fr]">
					<Card
						title={
							<Typography as="h2" variant="heading-400">
								{config.data.offer.name}
							</Typography>
						}
						description={config.data.offer.description || undefined}
						action={<Badge variant="outline">Test mode</Badge>}
					>
						<Stack gap={5}>
							<div className="flex flex-wrap items-baseline gap-2">
								<Typography variant="heading-500">
									{money(config.data.offer.amount, config.data.offer.currency)}
								</Typography>
								<span className="text-content-secondary">one time</span>
							</div>
							<p>{config.data.offer.credits.toLocaleString('en-GB')} credits</p>
							<p className="text-xs text-content-secondary">Test payment. No real charge.</p>
						</Stack>
					</Card>
					<Card
						title={
							<Typography as="h2" variant="heading-300">
								Payment details
							</Typography>
						}
					>
						<Stack gap={5}>
							{create.data?.clientSecret ? (
								<Suspense
									fallback={<Skeleton className="h-60" aria-label="Loading payment form" />}
								>
									<PaymentForm
										publishableKey={config.data.publishableKey}
										clientSecret={create.data.clientSecret}
										sessionId={create.data.sessionId}
									/>
								</Suspense>
							) : (
								<Button
									className="w-full"
									size="lg"
									onClick={() => create.mutate()}
									disabled={create.isPending}
								>
									{create.isPending ? 'Opening checkout…' : 'Continue to payment'}
								</Button>
							)}
							{create.error && (
								<Alert type="negative" message="Couldn't start checkout. Please try again." />
							)}
						</Stack>
					</Card>
				</div>
			)}
		</AppShell>
	)
}

import { Link, createFileRoute, redirect } from '@tanstack/react-router'

import {
	AppShell,
	appTitle,
	Alert,
	Button,
	PageSection,
	Skeleton,
	Stack,
	Typography,
} from '@workspace/shared'
import { lazy, Suspense } from 'react'
import { getSession } from '../lib/session'
import { signInPath } from '../lib/login'

import { money, useCheckoutSession } from '../hooks/use-checkout'
const PaymentForm = lazy(() => import('../components/payment-form'))
export const Route = createFileRoute('/credits')({
	beforeLoad: async ({ location }) => {
		const user = await getSession()
		if (!user) throw redirect({ href: signInPath(location.pathname, location.search) })
		return { user }
	},
	head: () => ({ meta: [{ title: appTitle('Test checkout') }] }),
	component: CheckoutPage,
})
function CheckoutPage() {
	const { availability, config, create } = useCheckoutSession()
	return (
		<AppShell title="Checkout">
			<Button
				variant="ghost"
				className="px-0"
				{...{ nativeButton: false }}
				render={<Link aria-label="← Back to workspace" role="link" to="/" />}
			>
				← Back to workspace
			</Button>
			{availability.isPending || (availability.data?.checkoutEnabled && config.isPending) ? (
				<Skeleton className="h-80 max-w-2xl" aria-label="Loading checkout" />
			) : availability.isError || config.isError ? (
				<PageSection title="Checkout is unavailable.">
					<Button
						variant="outline"
						onClick={() => void (availability.isError ? availability.refetch() : config.refetch())}
					>
						Try again
					</Button>
				</PageSection>
			) : !availability.data?.checkoutEnabled ? (
				<PageSection title="Checkout isn't configured.">
					<Button variant="outline" onClick={() => void availability.refetch()}>
						Check again
					</Button>
				</PageSection>
			) : config.data ? (
				<Stack gap={10}>
					<PageSection title={config.data.offer.name}>
						<Stack gap={5}>
							<Stack gap={2} direction="horizontal" align="baseline" wrap>
								<Typography variant="heading-500">
									{money(config.data.offer.amount, config.data.offer.currency)}
								</Typography>
								<Typography as="span" variant="body-200" className="text-content-secondary">
									one time
								</Typography>
							</Stack>
							<Typography as="p" variant="body-200">
								{config.data.offer.credits.toLocaleString('en-GB')} credits
							</Typography>
							<Typography as="p" variant="caption-100" className="text-content-secondary">
								Test payment. No real charge.
							</Typography>
						</Stack>
					</PageSection>
					<PageSection title="Payment details">
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
					</PageSection>
				</Stack>
			) : null}
		</AppShell>
	)
}

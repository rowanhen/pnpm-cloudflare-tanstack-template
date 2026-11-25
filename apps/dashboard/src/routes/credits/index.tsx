import { Alert, Button, Skeleton, Typography } from '@leitware/composables'
import { LinkButton, AppShell, appTitle, PageSection } from '@workspace/shared'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'

import { lazy, Suspense } from 'react'
import { getSession } from '../../lib/session'
import { signInPath } from '../../lib/login'

import { useCheckoutSession } from '../../hooks/use-checkout'
import { money } from '@workspace/shared/lib/money'
const PaymentForm = lazy(() => import('@workspace/shared/components/payment-form'))
export const Route = createFileRoute('/credits/')({
	beforeLoad: async ({ location }) => {
		const user = await getSession()
		if (!user) throw redirect({ href: signInPath(location.pathname, location.search) })
		return { user }
	},
	head: () => ({ meta: [{ title: appTitle('Test checkout') }] }),
	component: CheckoutPage,
})
function CheckoutPage() {
	const navigate = useNavigate()
	const { availability, config, create } = useCheckoutSession()
	return (
		<AppShell title="Checkout">
			<LinkButton variant="ghost" className="px-0" aria-label="← Back to workspace" to="/">
				← Back to workspace
			</LinkButton>
			{availability.isPending || (availability.data?.checkoutEnabled && config.isPending) ? (
				<Skeleton className="h-80 max-w-2xl" aria-label="Loading checkout" />
			) : availability.isError || config.isError ? (
				<PageSection title="Checkout is unavailable.">
					<Button
						variant="default"
						onClick={() => void (availability.isError ? availability.refetch() : config.refetch())}
					>
						Try again
					</Button>
				</PageSection>
			) : !availability.data?.checkoutEnabled ? (
				<PageSection title="Checkout isn't configured.">
					<Button variant="default" onClick={() => void availability.refetch()}>
						Check again
					</Button>
				</PageSection>
			) : config.data ? (
				<div className="flex min-w-0 flex-col gap-10">
					<PageSection title={config.data.offer.name}>
						<div className="flex min-w-0 flex-col gap-5">
							<div className="flex min-w-0 items-baseline flex-wrap gap-2">
								<Typography variant="heading-500">
									{money(config.data.offer.amount, config.data.offer.currency)}
								</Typography>
								<Typography as="span" variant="body-200" className="text-content-secondary">
									one time
								</Typography>
							</div>
							<Typography as="p" variant="body-200">
								{config.data.offer.credits.toLocaleString('en-GB')} credits
							</Typography>
						</div>
					</PageSection>
					<PageSection title="Payment details">
						<div className="flex min-w-0 flex-col gap-5">
							{create.data?.clientSecret ? (
								<Suspense
									fallback={<Skeleton className="h-60" aria-label="Loading payment form" />}
								>
									<PaymentForm
										publishableKey={config.data.publishableKey}
										clientSecret={create.data.clientSecret}
										onComplete={() =>
											navigate({
												to: '/checkout/success',
												search: { session_id: create.data.sessionId },
											})
										}
									/>
								</Suspense>
							) : (
								<Button
									variant="primary"
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
						</div>
					</PageSection>
				</div>
			) : null}
		</AppShell>
	)
}

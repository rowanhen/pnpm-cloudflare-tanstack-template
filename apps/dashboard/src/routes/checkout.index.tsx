import { lazy, Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
	AppShell,
	Alert,
	AlertDescription,
	Badge,
	Button,
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Separator,
	Skeleton,
} from '@workspace/shared'
import { money, useCheckoutSession } from '../hooks/use-checkout'
const PaymentForm = lazy(() => import('../components/payment-form'))
export const Route = createFileRoute('/checkout/')({
	head: () => ({ meta: [{ title: 'Test checkout — Idea Starter' }] }),
	component: CheckoutPage,
})
function CheckoutPage() {
	const { config, create } = useCheckoutSession()
	return (
		<AppShell
			title="Make it yours."
			description="A small purchase. A complete checkout experience."
		>
			<Button variant="link" className="px-0" asChild>
				<a href="/">← Back to workspace</a>
			</Button>
			{config.isPending ? (
				<Skeleton className="h-80 max-w-2xl" aria-label="Loading checkout" />
			) : config.isError ? (
				<Card className="max-w-lg">
					<CardHeader>
						<CardTitle>Test checkout isn't available yet.</CardTitle>
						<CardDescription>
							You can keep exploring your workspace and try again later.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button variant="outline" onClick={() => void config.refetch()}>
							Try again
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid items-start gap-8 lg:grid-cols-[.8fr_1fr]">
					<Card className="bg-secondary shadow-none">
						<CardHeader>
							<Badge className="w-fit" variant="outline">
								Test purchase · One time
							</Badge>
							<CardTitle>
								<h2 className="mt-3 text-2xl">{config.data.offer.name}</h2>
							</CardTitle>
							<CardDescription>
								{config.data.offer.description ??
									'A simple test purchase to try the full payment flow.'}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<p className="text-4xl font-semibold tracking-tight">
								{money(config.data.offer.amount, config.data.offer.currency)}
							</p>
							<Separator />
							<div className="flex justify-between text-sm">
								<span>Total due</span>
								<strong>{money(config.data.offer.amount, config.data.offer.currency)}</strong>
							</div>
							<p className="text-xs leading-5 text-muted-foreground">
								This is a test order. It demonstrates payment and order tracking; it doesn't unlock
								a paid plan.
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>
								<h2>Payment details</h2>
							</CardTitle>
							<CardDescription>Complete your order without leaving the app.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5">
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
								<>
									<p className="text-sm leading-6 text-muted-foreground">
										Ready to try it? Open the secure payment form to place your test order.
									</p>
									<Button
										className="w-full"
										size="lg"
										onClick={() => create.mutate()}
										disabled={create.isPending}
									>
										{create.isPending ? 'Opening checkout…' : 'Continue to payment'}
									</Button>
								</>
							)}
							{create.error && (
								<Alert variant="destructive">
									<AlertDescription>We couldn't start checkout. Please try again.</AlertDescription>
								</Alert>
							)}
						</CardContent>
					</Card>
				</div>
			)}
		</AppShell>
	)
}

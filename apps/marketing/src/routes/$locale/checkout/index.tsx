import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Alert, Button, Skeleton, Typography } from '@leitware/composables'
import { AnchorButton, useHydrated } from '@workspace/shared'
import { money, priceAmount } from '@workspace/shared/lib/money'
import { lazy, Suspense } from 'react'
import { storefrontOptions } from '../../../lib/storefront'
import { seo, site } from '../../../lib/seo'
import { MarketingFooter } from '../../-components/footer'
import { MarketingHeader } from '../../-components/header'
import { useStorefrontCheckout } from './-use-storefront-checkout'

const PaymentForm = lazy(() => import('@workspace/shared/components/payment-form'))

export const Route = createFileRoute('/$locale/checkout/')({
	loader: async ({ context }) => ({
		catalogue: await context.queryClient.query(storefrontOptions),
	}),
	head: ({ loaderData, params }) => {
		const head = seo(
			`/${params.locale}/checkout`,
			`Test products — ${site.name}`,
			'Explore the guest Stripe test checkout included with this starter.',
			true,
		)
		const products = loaderData?.catalogue.enabled ? loaderData.catalogue.products : []
		return {
			...head,
			scripts: products.length
				? [
						{
							type: 'application/ld+json',
							children: JSON.stringify({
								'@context': 'https://schema.org',
								'@type': 'ItemList',
								itemListElement: products.map((product, index) => ({
									'@type': 'ListItem',
									position: index + 1,
									item: {
										'@type': 'Product',
										name: product.name,
										...(product.description ? { description: product.description } : {}),
										url: `${site.url}/${params.locale}/checkout`,
										...(product.interval === null
											? {
													offers: {
														'@type': 'Offer',
														price: priceAmount(product.amount, product.currency),
														priceCurrency: product.currency.toUpperCase(),
													},
												}
											: {}),
									},
								})),
							}).replace(/</g, '\\u003c'),
						},
					]
				: [],
		}
	},
	component: StorefrontPage,
})

function StorefrontPage() {
	const { locale } = Route.useParams()
	const { data: catalogue } = useSuspenseQuery(storefrontOptions)
	const hydrated = useHydrated()
	const checkout = useStorefrontCheckout()
	const state = checkout.state
	const navigate = useNavigate()

	return (
		<div className="min-h-svh">
			<div className="page-container">
				<MarketingHeader />
				<main>
					<header className="py-16">
						<div className="flex min-w-0 flex-col gap-5">
							<Typography as="h1" variant="hero-300">
								Test checkout
							</Typography>
							<Typography as="p" variant="body-200" className="text-content-secondary">
								Try a guest purchase or subscription with Stripe test products. This example does
								not grant workspace credits.
							</Typography>
						</div>
					</header>
					<section className="py-24 border-t">
						{state.status === 'ready' ? (
							<div className="flex min-w-0 flex-col gap-8">
								<Typography as="h2" variant="heading-400">
									{state.product.name}
								</Typography>
								{state.product.description && (
									<Typography as="p" variant="body-200">
										{state.product.description}
									</Typography>
								)}
								<Typography as="p" variant="body-200">
									{money(state.product.amount, state.product.currency)}
									{state.product.interval ? ` / ${state.product.interval}` : ''}
								</Typography>
								<Suspense
									fallback={<Skeleton className="h-80" aria-label="Loading payment form" />}
								>
									<PaymentForm
										key={state.session.sessionId}
										publishableKey={state.session.publishableKey}
										clientSecret={state.session.clientSecret}
										collectEmail
										submitLabel={
											state.product.id === 'subscription'
												? 'Subscribe'
												: `Pay ${money(state.product.amount, state.product.currency)}`
										}
										onBack={checkout.back}
										onComplete={() =>
											navigate({
												to: '/$locale/checkout/complete',
												params: { locale },
												search: { session_id: state.session.sessionId },
											})
										}
									/>
								</Suspense>
							</div>
						) : !catalogue.enabled ? (
							<Typography as="h2" variant="heading-400">
								Checkout isn't configured.
							</Typography>
						) : (
							<div className="flex min-w-0 flex-col gap-8">
								{catalogue.products.map((product) => (
									<article key={product.id} className="space-y-4 border-b pb-8">
										<Typography as="h2" variant="heading-400">
											{product.name}
										</Typography>
										{product.description && (
											<Typography as="p" variant="body-200">
												{product.description}
											</Typography>
										)}
										<Typography as="p" variant="body-200">
											{money(product.amount, product.currency)}
											{product.interval ? ` / ${product.interval}` : ''}
										</Typography>
										<Button
											variant="primary"
											disabled={!hydrated || state.status === 'creating'}
											onClick={() => checkout.open(product)}
										>
											{state.status === 'creating' && state.product.id === product.id
												? 'Opening checkout…'
												: product.id === 'subscription'
													? 'Subscribe'
													: 'Buy'}
										</Button>
									</article>
								))}
								{state.status === 'error' && (
									<Alert type="negative">Couldn't open checkout. Please try again.</Alert>
								)}
							</div>
						)}
					</section>
					<section className="py-24 border-t">
						<AnchorButton href={`${site.dashboard}/credits`} variant="ghost">
							Buy workspace credits
						</AnchorButton>
					</section>
				</main>
				<MarketingFooter />
			</div>
		</div>
	)
}

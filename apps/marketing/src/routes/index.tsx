import { track } from '@workspace/observability/browser'
import { createFileRoute } from '@tanstack/react-router'
import { Badge, Button, LayerCard, Typography } from '@workspace/shared'
import { repository, seo, site } from '../lib/seo'
import { MarketingShell } from '../components/marketing-shell'
import { WaitlistForm } from '../components/waitlist-form'
import { QuickStart } from '../components/quick-start'

export const Route = createFileRoute('/')({ head: () => seo(), component: MarketingHomePage })
const features = [
	[
		'01',
		'Sign in. Stay private.',
		'Google auth, sessions and a protected dashboard.',
		'Better Auth',
	],
	[
		'02',
		'Your data, typed.',
		'D1 tables, Drizzle migrations and shared API types.',
		'D1 + Drizzle',
	],
	['03', 'Files, sorted.', 'Private uploads, downloads and deletion.', 'R2'],
	[
		'04',
		'Charge for what gets used.',
		'Custom checkout, credits and metered API requests.',
		'Stripe',
	],
	['05', 'An API of your own.', 'Scoped keys, revocation and rate limits.', 'REST'],
	['06', 'Keep people in the loop.', 'Waitlist confirmations and transactional email.', 'Email'],
	['07', 'See what happens.', 'Analytics, masked replay and API monitoring.', 'PostHog'],
]
function MarketingHomePage() {
	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: site.name,
		url: site.url,
		description: site.description,
	}
	return (
		<MarketingShell>
			<section className="grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
				<div className="space-y-7">
					<Badge variant="outline">A starter by Leitware</Badge>
					<Typography
						as="h1"
						variant="hero-300"
						className="max-w-xl text-5xl leading-[1.06] tracking-tight sm:text-6xl"
					>
						Your next idea.
						<br />
						<span className="text-brand">Already started.</span>
					</Typography>
					<p className="max-w-md text-lg leading-7 text-content-secondary">
						Auth, data, files, payments and email. One TypeScript repo, running on Cloudflare.
					</p>
					<div className="flex flex-wrap gap-3">
						<Button asChild size="lg">
							<a href={`${repository}/generate`} onClick={() => track('template.opened', {})}>
								Use the template <span aria-hidden="true">↗</span>
							</a>
						</Button>
						<Button asChild size="lg" variant="outline">
							<a href="#examples">
								Explore the examples <span aria-hidden="true">↓</span>
							</a>
						</Button>
					</div>
					<p className="text-xs text-content-secondary">
						TanStack Start · Drizzle · Composables / Kumo
					</p>
				</div>
				<div id="setup" className="min-w-0">
					<QuickStart />
				</div>
			</section>
			<section aria-labelledby="included-title" className="border-y py-12">
				<div className="mb-8 flex flex-wrap items-end justify-between gap-3">
					<h2 id="included-title" className="text-2xl font-semibold tracking-tight">
						The foundations, in place.
					</h2>
					<a href={`${repository}#what-is-included`} className="text-sm text-link hover:underline">
						Read the docs ↗
					</a>
				</div>
				<div className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
					{features.map(([number, title, description, tag]) => (
						<article key={number} className="space-y-3">
							<div className="flex items-center gap-3">
								<span className="font-mono text-xs text-content-secondary">{number}</span>
								<Badge variant="outline">{tag}</Badge>
							</div>
							<h3 className="font-semibold">{title}</h3>
							<p className="max-w-xs text-sm leading-6 text-content-secondary">{description}</p>
						</article>
					))}
				</div>
			</section>
			<section
				id="examples"
				aria-labelledby="examples-title"
				className="grid items-start gap-10 py-16 lg:grid-cols-2 lg:gap-16"
			>
				<div className="space-y-7">
					<div className="space-y-3">
						<h2 id="examples-title" className="text-3xl font-semibold tracking-tight">
							Take it for a spin.
						</h2>
						<p className="text-content-secondary">Real examples. Ready to make your own.</p>
					</div>
					<LayerCard title="Explore the demo">
						<nav aria-label="Examples" className="divide-y">
							{[
								['Dashboard', 'Todos, files, keys and email', site.dashboard],
								['Test checkout', 'Payments and API credits', `${site.dashboard}/checkout`],
								['Waitlist success', '', '/waitlist/success'],
								['404 page', '', '/not-a-page'],
								['Error page', '', '/error'],
							].map(([label, detail, href]) => (
								<a
									key={label}
									href={href}
									className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
								>
									<span>
										<span className="block text-sm font-medium group-hover:text-link">{label}</span>
										{detail && (
											<span className="mt-1 block text-xs text-content-secondary">{detail}</span>
										)}
									</span>
									<span aria-hidden="true">↗</span>
								</a>
							))}
						</nav>
					</LayerCard>
					<p className="text-xs leading-5 text-content-secondary">
						Google, Stripe and email need provider setup.{' '}
						<a
							className="text-link underline underline-offset-4"
							href={`${repository}/blob/main/docs/agent-setup.md`}
						>
							Setup guide ↗
						</a>
					</p>
				</div>
				<WaitlistForm />
			</section>
			<section className="mb-8 flex flex-wrap items-center justify-between gap-6 rounded-xl border bg-muted p-6 sm:p-8">
				<div className="space-y-2">
					<h2 className="text-lg font-semibold">Check it. Ship it. Start again.</h2>
					<p className="text-sm text-content-secondary">
						<code>pnpm validate</code> runs the API and browser tests. Add <code>--cloud</code> to
						test disposable cloud resources.
					</p>
				</div>
				<Button asChild variant="outline">
					<a href={`${repository}/blob/main/docs/agent-setup.md`}>Setup &amp; deployment ↗</a>
				</Button>
			</section>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
				}}
			/>
		</MarketingShell>
	)
}

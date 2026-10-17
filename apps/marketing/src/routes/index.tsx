import { track } from '@workspace/observability/browser'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
	Button,
	Typography,
	Stack,
	Grid,
	Section,
	Icon,
	ArrowDown,
	ArrowUpRight,
} from '@workspace/shared'
import { repository, seo, site } from '../lib/seo'
import { MarketingShell } from '../components/marketing-shell'
import { WaitlistForm } from '../components/waitlist-form'
import { QuickStart } from '../components/quick-start'

export const Route = createFileRoute('/')({ head: () => seo(), component: MarketingHomePage })
const features = [
	['Google sign-in', 'Sessions and a protected dashboard.'],
	['Database', 'D1 with Drizzle migrations.'],
	['File storage', 'Private uploads and downloads with R2.'],
	['Payments', 'Stripe checkout and API credits.'],
	['API keys', 'Scoped keys and rate limits.'],
	['Email', 'Waitlist and transactional email.'],
	['Analytics', 'PostHog events, replay and errors.'],
]
const exampleRoutes = [['Error page', '/error']] as const

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
			<Section spacing="lg">
				<Stack gap={8} align="start">
					<Typography as="h1" variant="hero-300">
						Cloudflare
						<br />
						Starter
					</Typography>
					<Typography variant="body-300" className="text-content-secondary">
						A TypeScript starter with auth, database, storage and payments.
					</Typography>
					<Stack direction="horizontal" align="center" gap={4} wrap>
						<Button
							size="lg"
							{...{ nativeButton: false }}
							render={
								<a role="link" aria-label="Use the template" href={`${repository}/generate`} />
							}
							onClick={() => track('template.opened', {})}
						>
							Use the template{' '}
							<Icon>
								<ArrowUpRight />
							</Icon>
						</Button>
						<Button
							variant="ghost"
							{...{ nativeButton: false }}
							render={<Link aria-label="Explore the examples" role="link" to="/" hash="examples" />}
						>
							Explore the examples{' '}
							<Icon>
								<ArrowDown />
							</Icon>
						</Button>
					</Stack>
				</Stack>
			</Section>
			<Section id="setup" aria-labelledby="setup-title" spacing="sm">
				<Stack gap={5}>
					<Typography as="h2" variant="heading-400" id="setup-title">
						Setup
					</Typography>
					<QuickStart />
				</Stack>
			</Section>
			<Section aria-labelledby="included-title" className="border-t">
				<Stack gap={8} align="start">
					<Typography as="h2" variant="heading-400" id="included-title">
						Included
					</Typography>
					<Stack gap={0} className="w-full divide-y">
						{features.map(([title, description]) => (
							<article key={title} className="py-4 first:pt-0 last:pb-0">
								<Grid columns={1} gap={2} className="sm:grid-cols-[11rem_1fr]">
									<Typography as="h3" variant="heading-100">
										{title}
									</Typography>
									<Typography variant="body-100" className="text-content-secondary">
										{description}
									</Typography>
								</Grid>
							</article>
						))}
					</Stack>
					<Button
						variant="ghost"
						{...{ nativeButton: false }}
						render={
							<a
								role="link"
								aria-label="Read the docs"
								href={`${repository}/blob/main/docs/reference.md`}
							/>
						}
					>
						Read the docs{' '}
						<Icon>
							<ArrowUpRight />
						</Icon>
					</Button>
				</Stack>
			</Section>
			<Section id="examples" aria-labelledby="examples-title" className="border-t">
				<Stack gap={8}>
					<Typography as="h2" variant="heading-400" id="examples-title">
						Examples
					</Typography>
					<Grid columns={1} gap={10} align="start" className="sm:grid-cols-2">
						<nav aria-label="Examples">
							<Stack gap={2} align="start">
								{[
									['Sign in', `${site.dashboard}/login`],
									['Dashboard', site.dashboard],
									['Test checkout', `${site.dashboard}/checkout`],
								].map(([label, href]) => (
									<Button
										key={label}
										variant="ghost"
										{...{ nativeButton: false }}
										render={<a role="link" aria-label={label} href={href} />}
									>
										{label}{' '}
										<Icon>
											<ArrowUpRight />
										</Icon>
									</Button>
								))}
								{exampleRoutes.map(([label, to]) => (
									<Button
										key={to}
										variant="ghost"
										{...{ nativeButton: false }}
										render={<Link aria-label={label} role="link" to={to} />}
									>
										{label}{' '}
										<Icon>
											<ArrowUpRight />
										</Icon>
									</Button>
								))}
								{/* An HTTP navigation deliberately demonstrates an unknown route. */}
								<Button
									variant="ghost"
									{...{ nativeButton: false }}
									render={<a role="link" aria-label="404 page" href="/not-a-page" />}
								>
									404 page{' '}
									<Icon>
										<ArrowUpRight />
									</Icon>
								</Button>
							</Stack>
						</nav>
						<WaitlistForm />
					</Grid>
				</Stack>
			</Section>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
				}}
			/>
		</MarketingShell>
	)
}

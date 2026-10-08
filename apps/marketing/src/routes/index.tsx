import { createFileRoute } from '@tanstack/react-router'
import { Button, Card, Input, Label, Checkbox, Alert, Stack, Typography } from '@workspace/shared'
import { seo, site } from '../lib/seo'
import { MarketingShell } from '../components/marketing-shell'
import { useWaitlist } from '../hooks/use-waitlist'

export const Route = createFileRoute('/')({ head: () => seo(), component: MarketingHomePage })
function MarketingHomePage() {
	const { disabled, busy, error, submit } = useWaitlist()
	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: site.name,
		url: site.url,
		description: site.description,
	}
	return (
		<MarketingShell>
			<section className="grid items-center gap-10 py-14 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:py-24">
				<Stack gap={6}>
					<Typography as="h1" variant="hero-300" className="text-5xl sm:text-6xl lg:text-7xl">
						From a small idea
						<br />
						to something <span className="text-brand">useful.</span>
					</Typography>
					<Typography variant="body-300" className="max-w-md text-content-secondary">
						A private workspace for your next idea.
					</Typography>
				</Stack>
				<Card
					id="waitlist"
					title={
						<Typography as="h2" variant="heading-400" id="waitlist-title">
							Get early access
						</Typography>
					}
					aria-labelledby="waitlist-title"
				>
					<form
						className="space-y-5"
						onSubmit={(event) => {
							event.preventDefault()
							void submit(event.currentTarget)
						}}
					>
						<Stack gap={2}>
							<Label htmlFor="name">Name (optional)</Label>
							<Input
								id="name"
								name="name"
								autoComplete="name"
								maxLength={100}
								disabled={disabled}
							/>
						</Stack>
						<Stack gap={2}>
							<Label htmlFor="email">Email address</Label>
							<Input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								maxLength={254}
								required
								disabled={disabled}
							/>
						</Stack>
						<div aria-hidden="true" className="absolute -left-[10000px]">
							<Label>
								Website
								<Input name="website" tabIndex={-1} autoComplete="off" />
							</Label>
						</div>
						<Stack direction="horizontal" align="start" gap={3}>
							<Checkbox id="consent" name="consent" required disabled={disabled} />
							<Label
								htmlFor="consent"
								className="block text-xs font-normal leading-5 text-content-secondary"
							>
								I agree to have my email saved for the waitlist.{' '}
								<a className="underline underline-offset-4" href="/privacy">
									Privacy details
								</a>
							</Label>
						</Stack>
						<Button type="submit" disabled={disabled} className="w-full" size="lg">
							{busy ? 'Joining…' : 'Join the waitlist'}
						</Button>
						{error && <Alert type="negative" message={error} />}
					</form>
				</Card>
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

import { createFileRoute } from '@tanstack/react-router'
import {
	Button,
	Badge,
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Input,
	Label,
	Checkbox,
	Alert,
	AlertDescription,
} from '@workspace/shared'
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
			<section className="grid items-center gap-12 py-14 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:py-24">
				<div className="space-y-7">
					<Badge variant="outline" className="px-3 py-1">
						Small beginnings, good things ahead
					</Badge>
					<h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
						From a small idea
						<br />
						to something <span className="text-primary">useful.</span>
					</h1>
					<p className="max-w-md text-lg leading-8 text-muted-foreground">{site.description}</p>
					<div className="flex flex-wrap gap-3">
						<Button size="lg" asChild>
							<a href="#waitlist">Get early access ↓</a>
						</Button>
						<Button size="lg" variant="ghost" asChild>
							<a href={site.dashboard}>Explore the workspace ↗</a>
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						No account needed to join. Your data stays yours.
					</p>
				</div>
				<Card id="waitlist" className="scroll-mt-8 shadow-sm" aria-labelledby="waitlist-title">
					<CardHeader>
						<Badge variant="secondary">The waitlist</Badge>
						<CardTitle>
							<h2 id="waitlist-title" className="text-2xl tracking-tight">
								Be first in line.
							</h2>
						</CardTitle>
						<CardDescription>Leave your email. We'll save you a place.</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="space-y-5"
							onSubmit={(event) => {
								event.preventDefault()
								void submit(event.currentTarget)
							}}
						>
							<div className="space-y-2">
								<Label htmlFor="name">Your name (optional)</Label>
								<Input
									id="name"
									name="name"
									autoComplete="name"
									maxLength={100}
									placeholder="Alex"
									disabled={disabled}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="email">Email address</Label>
								<Input
									id="email"
									name="email"
									type="email"
									autoComplete="email"
									maxLength={254}
									required
									placeholder="you@example.com"
									disabled={disabled}
								/>
							</div>
							<div aria-hidden="true" className="absolute -left-[10000px]">
								<Label>
									Website
									<Input name="website" tabIndex={-1} autoComplete="off" />
								</Label>
							</div>
							<div className="flex items-start gap-3">
								<Checkbox id="consent" name="consent" required disabled={disabled} />
								<Label
									htmlFor="consent"
									className="block text-xs font-normal leading-5 text-muted-foreground"
								>
									I agree to have my email saved for the waitlist.{' '}
									<a className="underline underline-offset-4" href="/privacy">
										Privacy details
									</a>
								</Label>
							</div>
							<Button type="submit" disabled={disabled} className="w-full" size="lg">
								{busy ? 'Joining…' : 'Join the waitlist'}
							</Button>
							{error && (
								<Alert variant="destructive">
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}
						</form>
					</CardContent>
				</Card>
			</section>
			<section className="grid gap-6 border-t pt-12 md:grid-cols-3" aria-label="What you can try">
				{[
					[
						'01',
						'A place to start',
						'Capture a thought, save a file, and find it right where you left it. Your own private workspace.',
					],
					[
						'02',
						'Built to connect',
						'Create a personal API key and connect your own scripts. You control the key and the data.',
					],
					[
						'03',
						'A complete first step',
						'Try a custom checkout with test payments, a clear confirmation, and helpful recovery pages.',
					],
				].map(([number, title, copy]) => (
					<div key={number} className="space-y-3">
						<p className="font-mono text-xs text-primary">{number} /</p>
						<h2 className="font-semibold">{title}</h2>
						<p className="text-sm leading-6 text-muted-foreground">{copy}</p>
					</div>
				))}
			</section>
			<section className="mt-16 rounded-2xl bg-secondary p-7 sm:p-10">
				<div className="grid gap-8 md:grid-cols-2">
					<div>
						<h2 className="text-2xl font-semibold tracking-tight">A few things to know.</h2>
						<p className="mt-3 text-sm text-muted-foreground">
							A simple starting point, with room to make it yours.
						</p>
					</div>
					<div className="space-y-6">
						<div>
							<h3 className="font-medium">What happens when I join?</h3>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								Your email is saved to the waitlist. This example doesn't send emails automatically.
							</p>
						</div>
						<div>
							<h3 className="font-medium">Can I try the workspace?</h3>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								Yes. Sign in with Google to try private records, file storage, API keys, and a test
								checkout.
							</p>
						</div>
					</div>
				</div>
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

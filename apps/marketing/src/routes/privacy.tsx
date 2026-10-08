import { Card, Stack } from '@workspace/shared'
import { MarketingShell } from '../components/marketing-shell'
import { createFileRoute } from '@tanstack/react-router'
import { seo, site } from '../lib/seo'
export const Route = createFileRoute('/privacy')({
	head: () =>
		seo('/privacy', `Privacy — ${site.name}`, 'How this example stores waitlist and account data.'),
	component: Privacy,
})
function Privacy() {
	return (
		<MarketingShell>
			<Card className="mx-auto my-12 max-w-2xl">
				<Stack gap={6} className="text-sm leading-7">
					<a href="/">← {site.name}</a>
					<h1 className="text-3xl font-semibold tracking-tight">Privacy in this demo</h1>
					<p>
						The waitlist stores the email address and optional name you submit, your consent, and
						the time you joined. When email is configured, it sends a confirmation and stores the
						delivery status.
					</p>
					<p>
						Google sign-in stores your name, email address, optional profile image, and the account
						identifiers needed to sign you in. Essential HTTP-only cookies keep you signed in. Your
						private records, files and API key hashes are stored in Cloudflare D1 and R2.
					</p>
					<p>
						Test checkout stores an order reference, amount, currency and payment status in D1.
						Stripe handles payment details; card numbers never pass through this app.
					</p>
					<p>
						This example includes no advertising or analytics trackers. Request counters are used to
						limit abuse.
					</p>
					<p>
						Leitware operates this demonstration. Demo records remain until you delete them or we
						reset the deployment. To request deletion of your account or waitlist entry, contact
						rowan@leitware.com. Replace this notice when using the template for your own project.
					</p>
				</Stack>
			</Card>
		</MarketingShell>
	)
}

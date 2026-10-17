import { Typography, Stack } from '@workspace/shared'
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
			<article className="py-12 sm:py-16">
				<Stack gap={6}>
					<Typography as="h1" variant="heading-500">
						Privacy
					</Typography>
					<Typography as="p" variant="body-200">
						The waitlist stores the email address and optional name you submit, your consent, and
						the time you joined. When email is configured, it sends a confirmation and stores the
						delivery status.
					</Typography>
					<Typography as="p" variant="body-200">
						Google sign-in stores your name, email address, optional profile image, and the account
						identifiers needed to sign you in. Essential HTTP-only cookies keep you signed in. Your
						private records, files and API key hashes are stored in Cloudflare D1 and R2.
					</Typography>
					<Typography as="p" variant="body-200">
						Test checkout stores an order reference, amount, currency and payment status in D1.
						Stripe handles payment details; card numbers never pass through this app.
					</Typography>
					<Typography as="p" variant="body-200">
						When configured, PostHog collects page visits, events and error reports only if you
						allow analytics. Masked session replay is a separate choice. Analytics uses an account
						ID for signed-in sessions; names, email addresses and form contents are excluded.
					</Typography>
					<Typography as="p" variant="body-200">
						Change or withdraw either choice through Privacy preferences. Global Privacy Control
						disables both. Each site remembers its own choices in your browser for up to 180 days.
						Rejecting optional tracking does not affect sign-in or other core features. Essential
						storage remembers your sign-in and privacy preferences. PostHog stores optional
						analytics and replay identifiers only while allowed.
					</Typography>
					<Typography as="p" variant="body-200">
						The API separately records operational route, status, timing and sanitized error data
						with a random request ID, without visitor identifiers or request contents. Request
						counters limit abuse. PostHog data retention follows the configured project settings.
					</Typography>
					<Typography as="p" variant="body-200">
						Leitware operates this demonstration. Demo records remain until you delete them or we
						reset the deployment. To request deletion of your account or waitlist entry, contact
						rowan@leitware.com. Replace this notice when using the template for your own project.
					</Typography>
				</Stack>
			</article>
		</MarketingShell>
	)
}

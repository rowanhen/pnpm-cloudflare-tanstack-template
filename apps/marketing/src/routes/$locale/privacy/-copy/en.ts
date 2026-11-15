import { site } from '../../../../lib/seo'

export default {
	seoTitle: `Privacy — ${site.name}`,
	seoDescription: 'How this example stores waitlist and account data.',
	title: 'Privacy in this demo',
	sectionTitle: 'Data and privacy',
	paragraphs: [
		'The waitlist stores the email address and optional name you submit, your consent, and the time you joined. When email is configured, it sends a confirmation and stores the delivery status.',
		'Google sign-in stores your name, email address, optional profile image, and the account identifiers needed to sign you in. Essential HTTP-only cookies keep you signed in. Your private records, files and API key hashes are stored in Cloudflare D1 and R2.',
		'Test checkout stores an order reference, amount, currency and payment status in D1. Stripe handles payment details; card numbers never pass through this app.',
		'When configured, PostHog collects page visits, events and error reports only if you allow analytics. Masked session replay is a separate choice. Analytics uses an account ID for signed-in sessions; names, email addresses and form contents are excluded.',
		'Change or withdraw either choice through Privacy preferences. Global Privacy Control disables both. Each site remembers its own choices in your browser for up to 180 days. Rejecting optional tracking does not affect sign-in or other core features. Essential storage remembers your sign-in and privacy preferences. PostHog stores optional analytics and replay identifiers only while allowed.',
		'The API separately records operational route, status, timing and sanitized error data with a random request ID, without visitor identifiers or request contents. Request counters limit abuse. PostHog data retention follows the configured project settings.',
		'Leitware operates this demonstration. Demo records remain until you delete them or we reset the deployment. To request deletion of your account or waitlist entry, contact rowan@leitware.com. Replace this notice when using the template for your own project.',
	],
}

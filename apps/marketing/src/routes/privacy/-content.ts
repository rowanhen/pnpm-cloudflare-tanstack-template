import type { MarketingPage } from '../../publishing/model'
import { site } from '../../lib/seo'

export default {
	kind: 'legal',
	status: 'published',
	seo: {
		title: `Privacy — ${site.name}`,
		description: 'How this example stores waitlist and account data.',
	},
	title: 'Privacy in this demo',
	intro: '',
	sections: [
		{
			id: 'privacy',
			title: 'Data and privacy',
			blocks: [
				{
					kind: 'paragraph',
					text: 'The waitlist stores the email address and optional name you submit, your consent, and the time you joined. When email is configured, it sends a confirmation and stores the delivery status.',
				},
				{
					kind: 'paragraph',
					text: 'Google sign-in stores your name, email address, optional profile image, and the account identifiers needed to sign you in. Essential HTTP-only cookies keep you signed in. Your private records, files and API key hashes are stored in Cloudflare D1 and R2.',
				},
				{
					kind: 'paragraph',
					text: 'Test checkout stores an order reference, amount, currency and payment status in D1. Stripe handles payment details; card numbers never pass through this app.',
				},
				{
					kind: 'paragraph',
					text: 'When configured, PostHog records page visits, interactions, browser errors and masked session replays only after you allow analytics. Change your choice with Analytics preferences on either site. Each site stores its own preference. Account IDs identify signed-in sessions; names, email addresses and form contents are excluded.',
				},
				{
					kind: 'paragraph',
					text: 'The API separately records operational route, status, timing and sanitized error data with a random request ID, without visitor identifiers or request contents. Request counters limit abuse. PostHog data retention follows the configured project settings.',
				},
				{
					kind: 'paragraph',
					text: 'Leitware operates this demonstration. Demo records remain until you delete them or we reset the deployment. To request deletion of your account or waitlist entry, contact rowan@leitware.com. Replace this notice when using the template for your own project.',
				},
			],
		},
	],
} satisfies MarketingPage

import type { MarketingPage } from '../publishing/model'
import { repository, site } from '../lib/seo'

export default {
	kind: 'landing',
	status: 'published',
	seo: { title: `${site.name} — By Leitware`, description: site.description },
	title: 'Cloudflare',
	accent: 'Starter',
	eyebrow: 'A starter by Leitware',
	intro: 'Auth, data, files, payments and email. One TypeScript repo, running on Cloudflare.',
	actions: [
		{ label: 'Use the template', href: `${repository}/generate`, event: 'template.opened' },
		{ label: 'Explore the examples', href: '#examples' },
	],
	sections: [
		{
			id: 'setup',
			title: 'Quick start',
			blocks: [
				{
					kind: 'commands',
					items: [
						{ label: 'Clone', value: `git clone ${repository}.git my-idea` },
						{ label: 'Install', value: 'cd my-idea && corepack enable && pnpm install' },
						{ label: 'Run', value: 'pnpm dev' },
					],
					note: 'Node 26.12.0 · pnpm 10.34.7 · No cloud account needed locally',
				},
				{ kind: 'paragraph', text: 'TanStack Start · Drizzle · Composables / Kumo' },
			],
		},
		{
			id: 'included',
			title: 'Included',
			blocks: [
				{
					kind: 'features',
					items: [
						{
							title: 'Google sign-in',
							description: 'Google auth, sessions and a protected dashboard.',
							tag: 'Better Auth',
						},
						{
							title: 'Database',
							description: 'D1 tables, Drizzle migrations and shared API types.',
							tag: 'D1 + Drizzle',
						},
						{
							title: 'File storage',
							description: 'Private uploads, downloads and deletion.',
							tag: 'R2',
						},
						{
							title: 'Payments and credits',
							description: 'Custom checkout, credits and metered API requests.',
							tag: 'Stripe',
						},
						{
							title: 'API keys',
							description: 'Scoped keys, revocation and rate limits.',
							tag: 'REST',
						},
						{
							title: 'Email',
							description: 'Waitlist confirmations and transactional email.',
							tag: 'Email',
						},
						{
							title: 'Analytics and errors',
							description: 'Analytics, masked replay and API monitoring.',
							tag: 'PostHog',
						},
					],
				},
				{
					kind: 'links',
					label: 'Documentation',
					items: [
						{ label: 'Read the docs', href: `${repository}/blob/main/docs/reference.md` },
						{ label: 'Getting started guide', href: '/guides/getting-started' },
					],
				},
			],
		},
		{
			id: 'examples',
			title: 'Examples',
			blocks: [
				{ kind: 'paragraph', text: 'Try the dashboard or submit the waitlist form.' },
				{
					kind: 'links',
					label: 'Examples',
					items: [
						{ label: 'Sign in', href: `${site.dashboard}/login` },
						{ label: 'Dashboard', detail: 'Todos, files, keys and email', href: site.dashboard },
						{
							label: 'Test checkout',
							detail: 'Payments and API credits',
							href: `${site.dashboard}/checkout`,
						},
						{ label: 'Waitlist success', href: '/waitlist/success' },
						{ label: '404 page', href: '/not-a-page' },
						{ label: 'Error page', href: '/error' },
					],
				},
				{ kind: 'paragraph', text: 'Google, Stripe, email and PostHog need provider setup.' },
				{ kind: 'waitlist', title: 'Try the waitlist' },
			],
		},
		{
			id: 'tests',
			title: 'Run the tests',
			blocks: [
				{
					kind: 'paragraph',
					text: 'pnpm validate runs formatting, schema, unit and API tests, type checks and builds.',
				},
				{
					kind: 'links',
					label: 'Setup documentation',
					items: [
						{
							label: 'Setup & deployment',
							href: `${repository}/blob/main/docs/getting-started.md`,
						},
					],
				},
			],
		},
	],
} satisfies MarketingPage

import type { MarketingPage } from '../../../publishing/model'
import { repository } from '../../../lib/seo'

export default {
	kind: 'guide',
	status: 'published',
	seo: {
		title: 'Getting started with the Cloudflare starter',
		description: 'Run the starter locally, explore the examples, and configure your providers.',
	},
	title: 'Getting started',
	intro: 'Start locally, then connect the services your project needs.',
	sections: [
		{
			id: 'local',
			title: 'Run locally',
			blocks: [
				{
					kind: 'list',
					ordered: true,
					items: [
						'Use the template to create your repository.',
						'Install Node 26.12.0 and pnpm 10.34.7.',
						'Run pnpm install, then pnpm dev.',
						'Open the marketing site on port 3000 and the dashboard on port 3001.',
					],
				},
			],
		},
		{
			id: 'providers',
			title: 'Connect providers',
			blocks: [
				{
					kind: 'paragraph',
					text: 'Google sign-in, Stripe, email and PostHog require provider configuration. Follow the repository setup guide before deploying.',
				},
				{
					kind: 'links',
					label: 'Next steps',
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

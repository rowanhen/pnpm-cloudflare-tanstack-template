import { execFileSync } from 'node:child_process'
import { root } from './setup-env.ts'
import manifest from '../package.json' with { type: 'json' }
import config from '../apps/api/wrangler.json' with { type: 'json' }

const app = process.argv[2] ?? 'all'
if (!['all', 'marketing', 'dashboard'].includes(app))
	throw new Error('Usage: pnpm deploy [marketing|dashboard]')
if (!process.env.VITE_API_URL)
	throw new Error('Set VITE_API_URL to your deployed API Worker URL before deploying the apps.')
if (
	(app === 'all' || app === 'marketing') &&
	(!process.env.VITE_SITE_URL || !process.env.VITE_DASHBOARD_URL || !process.env.VITE_NOINDEX)
)
	throw new Error(
		'Set VITE_SITE_URL, VITE_DASHBOARD_URL and VITE_NOINDEX (true for previews, false for production).',
	)
const run = (args: string[], cwd = root) => execFileSync('pnpm', args, { cwd, stdio: 'inherit' })
if (app === 'all') {
	if (
		config.vars.AUTH_URL !== process.env.VITE_DASHBOARD_URL ||
		!config.vars.AUTH_URL.startsWith('https://')
	)
		throw new Error(
			'Set AUTH_URL in apps/api/wrangler.json to the HTTPS VITE_DASHBOARD_URL before deployment.',
		)
	run(['db:migrate:remote'])
	run(['deploy:api'])
}
for (const target of ['marketing', 'dashboard'])
	if (app === 'all' || app === target) {
		run(['--filter', target, 'build'])
		run(
			[
				'exec',
				'wrangler',
				'pages',
				'deploy',
				'dist',
				'--project-name',
				`${manifest.name}-${target}`,
				'--branch',
				'main',
			],
			`${root}/apps/${target}`,
		)
	}

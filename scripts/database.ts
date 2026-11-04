import { spawnSync } from 'node:child_process'
import { root } from './setup-env.ts'

const [action, ...arguments_] = process.argv.slice(2)
if (!['generate', 'check', 'migrate'].includes(action)) throw new Error('Unknown database action')
if (arguments_.includes('--domain')) throw new Error('All tables now share DB. Omit --domain.')
const args =
	action === 'migrate'
		? ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', ...arguments_]
		: [
				'--filter',
				'@workspace/data',
				'exec',
				'drizzle-kit',
				action,
				'--config',
				'drizzle.config.ts',
				...arguments_,
			]
const result = spawnSync('pnpm', args, {
	cwd: action === 'migrate' ? `${root}/apps/api` : root,
	env: process.env,
	stdio: 'inherit',
})
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

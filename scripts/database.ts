import { spawnSync } from 'node:child_process'
import { domains, type Domain } from '../packages/data/src/domains.ts'
import { root } from './setup-env.ts'

const [action, ...arguments_] = process.argv.slice(2)
const domainIndex = arguments_.indexOf('--domain')
const selected = domainIndex < 0 ? undefined : arguments_[domainIndex + 1]
if (selected && !Object.hasOwn(domains, selected)) throw new Error('Unknown database domain')
if (domainIndex >= 0) arguments_.splice(domainIndex, 2)
if (action === 'generate' && !selected)
	throw new Error('Choose --domain identity, billing or product')
if (!['generate', 'check', 'migrate'].includes(action)) throw new Error('Unknown database action')
for (const domain of selected ? [selected as Domain] : (Object.keys(domains) as Domain[])) {
	const args =
		action === 'migrate'
			? ['exec', 'wrangler', 'd1', 'migrations', 'apply', domains[domain].binding, ...arguments_]
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
		env: { ...process.env, DB_DOMAIN: domain },
		stdio: 'inherit',
	})
	if (result.error) throw result.error
	if (result.status !== 0) process.exit(result.status ?? 1)
}

import { spawnSync } from 'node:child_process'
import { root, setupEnv } from './setup-env.mjs'
const env = await setupEnv()
const commands = [
	['check'],
	['exec', 'playwright', 'install', 'chromium'],
	['test:browser'],
	['test:dev'],
	...(process.argv.includes('--cloud') ? [['test:remote'], ['test:cloud-setup']] : []),
]
for (const args of commands) {
	const result = spawnSync('pnpm', args, { cwd: root, env, stdio: 'inherit' })
	if (result.error) throw result.error
	if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log(
	'Validation passed. Google consent/code exchange and real Stripe card completion and email inbox delivery remain separate provider checks.',
)

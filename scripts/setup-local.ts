import { setupEnv, root } from './setup-env.ts'
import { posthogBuildEnv } from './posthog-env.ts'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { hasCode } from './tooling.ts'
import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const path = new URL('../apps/api/.dev.vars', import.meta.url)
try {
	await writeFile(
		path,
		`BETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\n# GOOGLE_CLIENT_ID=\n# GOOGLE_CLIENT_SECRET=\n# STRIPE_SECRET_KEY=\n# STRIPE_PUBLISHABLE_KEY=\n# STRIPE_PRICE_ID=\n# STRIPE_WEBHOOK_SECRET=\n`,
		{ flag: 'wx', mode: 0o600 },
	)
	console.log(
		'Created apps/api/.dev.vars with a random local auth secret. Add Google OAuth credentials to enable sign-in.',
	)
} catch (error) {
	if (!hasCode(error, 'EEXIST')) throw error
	console.log('Using existing apps/api/.dev.vars.')
}

const telemetry = posthogBuildEnv(await setupEnv())
for (const app of ['marketing', 'dashboard']) {
	const file = resolve(root, 'apps', app, '.env.local')
	const previous = await readFile(file, 'utf8').catch((error) => {
		if (hasCode(error, 'ENOENT')) return ''
		throw error
	})
	const other = previous
		.split('\n')
		.filter((line) => !/^VITE_(POSTHOG_KEY|POSTHOG_HOST|APP_ENV)=/.test(line))
		.join('\n')
		.trimEnd()
	await writeFile(
		file,
		`${other}\n${Object.entries(telemetry)
			.map(([key, value]) => `${key}=${JSON.stringify(value)}`)
			.join('\n')}\n`,
		{ mode: 0o600 },
	)
}

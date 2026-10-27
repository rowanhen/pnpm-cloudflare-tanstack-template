import { setupEnv, root } from './setup-env.ts'
import { posthogBuildEnv } from './posthog-env.ts'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { hasCode } from './tooling.ts'
import { randomBytes } from 'node:crypto'
import { parseEnv } from 'node:util'

const path = new URL('../apps/api/.dev.vars', import.meta.url)
const example = await readFile(new URL('../apps/api/.dev.vars.example', import.meta.url), 'utf8')
try {
	await writeFile(
		path,
		example.replace(
			/^BETTER_AUTH_SECRET=.*$/m,
			`BETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}`,
		),
		{ flag: 'wx', mode: 0o600 },
	)
	console.log(
		'Created apps/api/.dev.vars with a random local auth secret. Add Google OAuth credentials to enable sign-in.',
	)
} catch (error) {
	if (!hasCode(error, 'EEXIST')) throw error
	console.log('Using existing apps/api/.dev.vars.')
}

const env = await setupEnv()
const local = parseEnv(await readFile(path, 'utf8'))
for (const key of [
	'GOOGLE_CLIENT_ID',
	'GOOGLE_CLIENT_SECRET',
	'STRIPE_SECRET_KEY',
	'STRIPE_PUBLISHABLE_KEY',
	'STRIPE_PRICE_ID',
	'STRIPE_DEMO_PRICE_ID',
	'STRIPE_SUBSCRIPTION_PRICE_ID',
]) {
	if (env[key]) local[key] = env[key]
}
if (env.DEV_BETTER_AUTH_SECRET) local.BETTER_AUTH_SECRET = env.DEV_BETTER_AUTH_SECRET
if (env.STRIPE_LOCAL_WEBHOOK_SECRET) local.STRIPE_WEBHOOK_SECRET = env.STRIPE_LOCAL_WEBHOOK_SECRET
await writeFile(
	path,
	Object.entries(local)
		.map(([key, value]) => `${key}=${JSON.stringify(value)}`)
		.join('\n') + '\n',
	{ mode: 0o600 },
)
const telemetry = posthogBuildEnv(env)
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

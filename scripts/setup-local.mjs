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
	if (error.code !== 'EEXIST') throw error
	console.log('Using existing apps/api/.dev.vars.')
}

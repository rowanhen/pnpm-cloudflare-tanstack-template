import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { fixtures } from './test-fixtures.mjs'
import { waitForApi } from './test-api.mjs'
import { stripeFixture } from './stripe-fixture.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
export async function localWorker(port) {
	const storage = await mkdtemp(join(tmpdir(), 'cloudflare-template-test-'))
	const secret = randomBytes(32).toString('hex')
	const fixture = fixtures(secret)
	const proxySecret = randomBytes(32).toString('hex')
	const common = ['--config', 'apps/api/wrangler.json', '--persist-to', storage]
	const run = (args) =>
		execFileSync('pnpm', ['exec', 'wrangler', ...args], { cwd: root, stdio: 'inherit' })
	let child, stripe, stopping
	function stop() {
		stopping ??= closeResources()
		return stopping
	}
	async function closeResources() {
		if (child && child.exitCode === null) {
			const exited = once(child, 'exit')
			process.kill(-child.pid, 'SIGTERM')
			await exited
		}
		await stripe?.stop()
		await rm(storage, { recursive: true, force: true })
	}
	try {
		run(['d1', 'migrations', 'apply', 'DB', '--local', ...common])
		const sql = join(storage, 'fixtures.sql')
		await writeFile(sql, fixture.sql, { mode: 0o600 })
		run(['d1', 'execute', 'DB', '--local', ...common, '--file', sql])
		await rm(sql)
		stripe = await stripeFixture()
		const wrapper = join(storage, 'test-worker.mjs')
		await writeFile(
			wrapper,
			`import worker from ${JSON.stringify(join(root, 'apps/api/src/index.ts'))};
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
 const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
 if (new URL(url).origin === 'https://api.stripe.com') return originalFetch(url.replace('https://api.stripe.com', ${JSON.stringify(stripe.url)}), init);
 return originalFetch(input, init);
};
export default { fetch(request, env, context) {
 if (new URL(request.url).pathname === '/api/auth/get-session' && request.headers.get('x-test-session-failure') === 'true') return new Response('Test upstream unavailable', { status: 503 });
 if (request.headers.get('x-test-email-failure') === 'true') env = {...env, EMAIL: {send: async () => {throw new Error('E_DELIVERY_FAILED test fixture')}}};
 if (request.headers.get('x-test-email-disabled') === 'true') env = {...env, EMAIL_FROM: undefined};
 return worker.fetch(request, env, context);
}};`,
		)
		child = spawn(
			'pnpm',
			[
				'exec',
				'wrangler',
				'dev',
				wrapper,
				...common,
				'--port',
				String(port),
				'--var',
				`BETTER_AUTH_SECRET:${secret}`,
				'--var',
				`API_PROXY_SECRET:${proxySecret}`,
				'--var',
				'GOOGLE_CLIENT_ID:e2e-client.apps.googleusercontent.com',
				'--var',
				'GOOGLE_CLIENT_SECRET:e2e-provider-not-a-real-secret',
				'--var',
				'STRIPE_SECRET_KEY:sk_test_fixture',
				'--var',
				'STRIPE_PUBLISHABLE_KEY:pk_test_fixture',
				'--var',
				'STRIPE_PRICE_ID:price_fixture',
				'--var',
				'STRIPE_WEBHOOK_SECRET:whsec_fixture',
				'--var',
				'EMAIL_FROM:starter@example.test',
			],
			{ cwd: root, stdio: 'inherit', detached: true },
		)
		const base = `http://localhost:${port}`
		await waitForApi(base, child)
		return {
			base,
			fixture,
			proxySecret,
			stripeUrl: stripe.url,
			stop,
			query(statement) {
				return JSON.parse(
					execFileSync(
						'pnpm',
						[
							'exec',
							'wrangler',
							'd1',
							'execute',
							'DB',
							'--local',
							...common,
							'--command',
							statement,
							'--json',
						],
						{ cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
					),
				)[0].results
			},
		}
	} catch (error) {
		await stop()
		throw error
	}
}

import { z } from 'zod'
import type { ChildProcess } from 'node:child_process'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { fixtures } from './test-fixtures.ts'
import { waitForApi } from './test-api.ts'
import { stripeFixture } from './stripe-fixture.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
export async function localWorker(port: string | number) {
	const storage = await mkdtemp(join(tmpdir(), 'cloudflare-template-test-'))
	const secret = randomBytes(32).toString('hex')
	const fixture = fixtures(secret)
	const proxySecret = randomBytes(32).toString('hex')
	const common = ['--config', 'apps/api/wrangler.json', '--persist-to', storage]
	const run = (args: string[]) =>
		execFileSync('pnpm', ['exec', 'wrangler', ...args], { cwd: root, stdio: 'inherit' })
	let child: ChildProcess | undefined
	let stripe: Awaited<ReturnType<typeof stripeFixture>> | undefined
	let stopping: Promise<void> | undefined
	function stop() {
		stopping ??= closeResources()
		return stopping
	}
	async function closeResources() {
		if (child && child.exitCode === null && child.pid) {
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
		const wrapper = join(root, 'scripts/workers/test-worker.ts')
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
				'--var',
				`STRIPE_FIXTURE_URL:${stripe.url}`,
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
			query(statement: string) {
				const result: unknown = JSON.parse(
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
				)
				return z
					.array(
						z.object({
							results: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
						}),
					)
					.parse(result)[0].results
			},
		}
	} catch (error) {
		await stop()
		throw error
	}
}

export type LocalWorker = Awaited<ReturnType<typeof localWorker>>

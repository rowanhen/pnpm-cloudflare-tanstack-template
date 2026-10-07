import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { fixtures } from './test-fixtures.mjs'
import { waitForApi } from './test-api.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
export async function localWorker(port) {
	const storage = await mkdtemp(join(tmpdir(), 'cloudflare-template-test-'))
	const secret = randomBytes(32).toString('hex')
	const fixture = fixtures(secret)
	const proxySecret = randomBytes(32).toString('hex')
	const common = ['--config', 'apps/api/wrangler.json', '--persist-to', storage]
	const run = (args) =>
		execFileSync('pnpm', ['exec', 'wrangler', ...args], { cwd: root, stdio: 'inherit' })
	let child
	async function stop() {
		if (child && child.exitCode === null) {
			const exited = once(child, 'exit')
			process.kill(-child.pid, 'SIGTERM')
			await exited
		}
		await rm(storage, { recursive: true, force: true })
	}
	try {
		run(['d1', 'migrations', 'apply', 'DB', '--local', ...common])
		const sql = join(storage, 'fixtures.sql')
		await writeFile(sql, fixture.sql, { mode: 0o600 })
		run(['d1', 'execute', 'DB', '--local', ...common, '--file', sql])
		await rm(sql)
		child = spawn(
			'pnpm',
			[
				'exec',
				'wrangler',
				'dev',
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
			],
			{ cwd: root, stdio: 'inherit', detached: true },
		)
		const base = `http://localhost:${port}`
		await waitForApi(base, child)
		return { base, fixture, proxySecret, stop }
	} catch (error) {
		await stop()
		throw error
	}
}

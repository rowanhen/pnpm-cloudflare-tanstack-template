import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { testApi, waitForApi } from './test-api.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const storage = await mkdtemp(join(tmpdir(), 'cloudflare-template-test-'))
const port = process.env.TEST_API_PORT ?? '8799'
let child
async function stop() {
	if (child && child.exitCode === null) {
		const exited = once(child, 'exit')
		process.kill(-child.pid, 'SIGTERM')
		await exited
	}
	await rm(storage, { recursive: true, force: true })
}
for (const signal of ['SIGINT', 'SIGTERM'])
	process.once(signal, () => {
		void stop().finally(() => process.exit(1))
	})
try {
	execFileSync(
		'pnpm',
		[
			'exec',
			'wrangler',
			'd1',
			'migrations',
			'apply',
			'DB',
			'--local',
			'--config',
			'apps/api/wrangler.json',
			'--persist-to',
			storage,
		],
		{ cwd: root, stdio: 'inherit' },
	)
	child = spawn(
		'pnpm',
		[
			'exec',
			'wrangler',
			'dev',
			'--config',
			'apps/api/wrangler.json',
			'--port',
			port,
			'--persist-to',
			storage,
			'--var',
			'REQUIRE_AUTH:true',
			'--var',
			'API_TOKEN:local-test-token',
		],
		{ cwd: root, stdio: 'inherit', detached: true },
	)
	const base = `http://localhost:${port}`
	await waitForApi(base, child)
	await testApi(base, 'local-test-token')
} finally {
	await stop()
	console.log('Local test Worker stopped and isolated D1/R2 storage removed.')
}

import {
	cloudflareApi,
	databases as databaseList,
	database as databaseSchema,
	buckets as bucketList,
	workers as workerList,
	subdomain,
} from './cloudflare-api.ts'
import { remoteManifest, type RemoteManifest } from './resource-manifests.ts'
import { workerConfig } from './tooling.ts'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { randomUUID, randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { testApi, waitForApi } from './test-api.ts'
import { testMetering } from './test-metering.ts'
import { fixtures } from './test-fixtures.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const account = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_API_TOKEN
if (!account || !token)
	throw new Error(
		'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (D1, R2, Workers Scripts and Pages edit permissions).',
	)
const cleanupPath = process.argv[2] === '--cleanup' ? resolve(process.argv[3]) : null
const name = `template-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`
const directory = cleanupPath ? resolve(cleanupPath, '..') : resolve(root, '.wrangler', name)
await mkdir(directory, { recursive: true })
const manifestPath = cleanupPath ?? resolve(directory, 'resources.json')
const state: RemoteManifest = cleanupPath
	? remoteManifest.parse(JSON.parse(await readFile(manifestPath, 'utf8')))
	: {
			account,
			name,
			databaseName: `${name}-db`,
			bucket: `${name}-files`,
			workerAttempted: false,
			bucketAttempted: false,
			databaseAttempted: false,
			pagesAttempted: [],
		}
if (
	state.account !== account ||
	!/^template-e2e-\d+-[a-f0-9]{8}$/.test(state.name) ||
	state.databaseName !== `${state.name}-db` ||
	state.bucket !== `${state.name}-files` ||
	(state.pagesAttempted ?? []).some(
		(project) => ![`${state.name}-dashboard`, `${state.name}-marketing`].includes(project),
	) ||
	directory !== resolve(root, '.wrangler', state.name)
)
	throw new Error('Invalid cleanup manifest or account mismatch')
const save = () => writeFile(manifestPath, JSON.stringify(state, null, 2), { mode: 0o600 })
await save()
const cf = cloudflareApi(token, `/accounts/${account}`)
function wrangler(args: string[]) {
	return execFileSync('pnpm', ['exec', 'wrangler', ...args], {
		cwd: root,
		stdio: 'inherit',
		env: { ...process.env, CI: 'true' },
		timeout: 180000,
	})
}
let cleaning: Promise<void> | undefined
function cleanup() {
	if (cleaning) return cleaning
	cleaning = (async () => {
		const failures: unknown[] = []
		async function attempt(label: string, action: () => Promise<unknown>) {
			for (let count = 0; count < 3; count++) {
				try {
					await action()
					console.log(`Cleaned up ${label}`)
					return
				} catch (error) {
					if (count === 2) failures.push(error)
					else await new Promise((done) => setTimeout(done, 1500))
				}
			}
		}
		for (const project of state.pagesAttempted ?? []) {
			await attempt(`Pages project ${project}`, () =>
				cf(`/pages/projects/${project}`, 'DELETE', undefined, true),
			)
		}
		if (state.bucketAttempted) {
			await attempt('R2 objects and bucket', async () => {
				const buckets = await cf.read('/r2/buckets', bucketList)
				if (!buckets.buckets.some((bucket) => bucket.name === state.bucket)) return
				// All keys this isolated test can write; remote object deletion works even if the Worker failed.
				for (const key of ['e2e-file.txt', 'e2e-binary.bin', 'e2e-empty.txt', 'e2e-browser.txt']) {
					wrangler(['r2', 'object', 'delete', `${state.bucket}/e2e-alice/${key}`, '--remote'])
				}
				await cf(`/r2/buckets/${state.bucket}`, 'DELETE', undefined, true)
			})
		}
		if (state.databaseAttempted)
			await attempt('D1 database', async () => {
				const databases = await cf.read('/d1/database?per_page=1000', databaseList)
				const database = databases.find((item) => item.name === state.databaseName)
				if (database) await cf(`/d1/database/${database.uuid}`, 'DELETE', undefined, true)
			})
		if (state.workerAttempted)
			await attempt('Worker', () => cf(`/workers/scripts/${state.name}`, 'DELETE', undefined, true))
		if (failures.length) {
			console.error(`Cleanup incomplete. Retry: pnpm test:remote --cleanup ${manifestPath}`)
			throw new AggregateError(failures, 'Remote cleanup failed')
		}
		// Confirm resource absence, independently of the delete responses.
		const databases = await cf.read('/d1/database?per_page=1000', databaseList)
		const buckets = await cf.read('/r2/buckets', bucketList)
		const workers = await cf.read('/workers/scripts', workerList)
		if (
			databases.some((item) => item.name === state.databaseName) ||
			buckets.buckets.some((item) => item.name === state.bucket) ||
			workers.some((item) => item.id === state.name)
		)
			throw new Error(`Resources remain; retain cleanup manifest: ${manifestPath}`)
		for (const project of state.pagesAttempted ?? []) {
			if (await cf(`/pages/projects/${project}`, 'GET', undefined, true))
				throw new Error(`Pages project remains: ${project}`)
		}
		await rm(directory, { recursive: true, force: true })
		console.log('Verified: temporary Pages projects, Worker, D1 database and R2 bucket are absent.')
	})()
	return cleaning
}
for (const signal of ['SIGINT', 'SIGTERM'])
	process.once(signal, () => {
		void cleanup().finally(() => process.exit(1))
	})
if (cleanupPath) {
	await cleanup()
} else {
	try {
		console.log(`Creating isolated cloud test resources: ${state.name}`)
		const dashboardUrl = `https://${state.name}-dashboard.pages.dev`
		const marketingUrl = `https://${state.name}-marketing.pages.dev`
		state.databaseAttempted = true
		await save()
		const database = databaseSchema.parse(
			await cf('/d1/database', 'POST', { name: state.databaseName }),
		)
		state.databaseId = database.uuid
		await save()
		state.bucketAttempted = true
		await save()
		await cf('/r2/buckets', 'POST', { name: state.bucket })
		const config = workerConfig()
		config.name = state.name
		config.main = resolve(root, 'apps/api/src/index.ts')
		config.d1_databases[0] = {
			binding: 'DB',
			database_name: state.databaseName,
			database_id: database.uuid,
			migrations_dir: resolve(root, 'apps/api/migrations'),
		}
		config.r2_buckets[0].bucket_name = state.bucket
		config.account_id = account
		config.vars.AUTH_URL = dashboardUrl
		config.vars.ALLOWED_ORIGINS += `,${dashboardUrl},${marketingUrl}`
		const configPath = resolve(directory, 'wrangler.json')
		await writeFile(configPath, JSON.stringify(config, null, 2))
		const authSecret = randomBytes(32).toString('hex')
		const fixture = fixtures(authSecret, true)
		const proxySecret = randomBytes(32).toString('hex')
		const secretsPath = resolve(directory, 'secrets.json')
		await writeFile(
			secretsPath,
			JSON.stringify({
				BETTER_AUTH_SECRET: authSecret,
				API_PROXY_SECRET: proxySecret,
				GOOGLE_CLIENT_ID: 'e2e-client.apps.googleusercontent.com',
				GOOGLE_CLIENT_SECRET: 'e2e-provider-not-a-real-secret',
			}),
			{ mode: 0o600 },
		)
		wrangler(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', configPath])
		const fixturePath = resolve(directory, 'fixtures.sql')
		await writeFile(fixturePath, fixture.sql, { mode: 0o600 })
		wrangler(['d1', 'execute', 'DB', '--remote', '--config', configPath, '--file', fixturePath])
		await rm(fixturePath)
		state.workerAttempted = true
		await save()
		wrangler(['deploy', '--config', configPath, '--secrets-file', secretsPath])
		await rm(secretsPath)
		const { subdomain: workerSubdomain } = await cf.read('/workers/subdomain', subdomain)
		const base = `https://${state.name}.${workerSubdomain}.workers.dev`
		await waitForApi(base)
		// Workers routes can propagate after the first successful health response.
		let ready = 0
		const propagationStarted = Date.now()
		for (
			let attempt = 0;
			attempt < 120 && (ready < 10 || Date.now() - propagationStarted < 45000);
			attempt++
		) {
			const response = await fetch(`${base}/api/todos`, {
				headers: { Cookie: fixture.cookies[0] },
				signal: AbortSignal.timeout(10000),
			})
			ready = response.ok ? ready + 1 : 0
			if (!response.ok) console.log(`Waiting for API route propagation (${response.status})`)
			await new Promise((done) => setTimeout(done, 1000))
		}
		if (ready < 10) throw new Error('Authenticated API route did not become ready')
		await testApi(base, fixture.cookies, proxySecret, dashboardUrl)
		await testMetering(base, fixture.cookies, dashboardUrl)
		for (const app of ['dashboard', 'marketing']) {
			const project = `${state.name}-${app}`
			state.pagesAttempted.push(project)
			await save()
			const deployment = {
				compatibility_date: '2026-10-01',
				env_vars: { API_PROXY_SECRET: { type: 'secret_text', value: proxySecret } },
			}
			await cf('/pages/projects', 'POST', {
				name: project,
				production_branch: 'main',
				deployment_configs: { production: deployment, preview: deployment },
			})
			execFileSync('pnpm', ['--filter', app, 'build'], {
				cwd: root,
				stdio: 'inherit',
				timeout: 180000,
				env: {
					...process.env,
					VITE_API_URL: base,
					VITE_SITE_URL: marketingUrl,
					VITE_DASHBOARD_URL: dashboardUrl,
					VITE_NOINDEX: 'true',
				},
			})
			wrangler([
				'pages',
				'deploy',
				resolve(root, `apps/${app}/dist`),
				'--project-name',
				project,
				'--branch',
				'main',
				'--commit-dirty=true',
			])
		}
		await waitForApi(dashboardUrl)
		// Give newly created Pages aliases time to propagate before browser navigation.
		for (let attempt = 0; attempt < 45; attempt++) {
			await fetch(`${dashboardUrl}/api/health`, { signal: AbortSignal.timeout(15000) })
			await new Promise((done) => setTimeout(done, 1000))
		}
		console.log('Testing live Cloudflare Pages, Worker, D1 and R2 in Chromium.')
		execFileSync('pnpm', ['test:browser'], {
			cwd: root,
			stdio: 'inherit',
			timeout: 180000,
			env: {
				...process.env,
				E2E_API_URL: base,
				E2E_DASHBOARD_URL: dashboardUrl,
				E2E_MARKETING_URL: marketingUrl,
				E2E_PROXY_SECRET: proxySecret,
				E2E_COOKIE_ALICE: fixture.cookies[0],
				E2E_COOKIE_BOB: fixture.cookies[1],
			},
		})
	} finally {
		await cleanup()
	}
}

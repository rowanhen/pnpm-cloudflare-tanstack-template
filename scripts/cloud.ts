import { attachDomain, publicSite, removeDomainDns } from './site-domain.ts'
import { z } from 'zod'
import {
	cloudflareApi,
	databases,
	database as databaseSchema,
	buckets,
	workers,
	subdomain as subdomainSchema,
} from './cloudflare-api.ts'
import { sandboxManifest, type SandboxManifest } from './resource-manifests.ts'
import { hasCode, workerConfig, type WorkerConfig } from './tooling.ts'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { root, setupEnv } from './setup-env.ts'

const [action, slug] = process.argv.slice(2)
if (
	!['up', 'check', 'down', 'domain'].includes(action) ||
	!/^[a-z][a-z0-9-]{0,24}$/.test(slug ?? '')
)
	throw new Error(
		'Usage: pnpm cloud:up|cloud:check|cloud:down|cloud:domain NAME (lowercase, max 25 characters)',
	)
const env = await setupEnv()
const account = z
	.string()
	.regex(/^[a-f0-9]{32}$/)
	.parse(env.CLOUDFLARE_ACCOUNT_ID)
const token = env.CLOUDFLARE_API_TOKEN
if (!account || !/^[a-f0-9]{32}$/.test(account) || !token)
	throw new Error(
		'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN. Run pnpm setup:doctor for readiness.',
	)
const directory = resolve(root, '.wrangler', 'sandboxes', slug)
const manifestPath = resolve(directory, 'resources.json')
const secretsPath = resolve(directory, 'secrets.env')
const configPath = resolve(directory, 'wrangler.json')
const stripeManifest = resolve(directory, 'stripe.json')
await mkdir(directory, { recursive: true, mode: 0o700 })
const lock = resolve(directory, '.lock')
try {
	await writeFile(lock, String(process.pid), { flag: 'wx', mode: 0o600 })
} catch (error) {
	if (hasCode(error, 'EEXIST'))
		throw new Error(
			`Sandbox is locked. If no setup process is running, remove ${lock} and retry.`,
			{ cause: error },
		)
	throw error
}
async function saveJson(path: string, value: unknown) {
	await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2), { mode: 0o600 })
	await rename(`${path}.tmp`, path)
}
const exists = async (path: string) =>
	readFile(path).then(
		() => true,
		(error) => {
			if (hasCode(error, 'ENOENT')) return false
			throw error
		},
	)
const cf = cloudflareApi(token, `/accounts/${account}`)
function run(args: string[], extra: NodeJS.ProcessEnv = {}) {
	execFileSync('pnpm', args, {
		cwd: root,
		stdio: 'inherit',
		timeout: 180000,
		env: {
			...process.env,
			CLOUDFLARE_ACCOUNT_ID: account,
			CLOUDFLARE_API_TOKEN: token,
			CI: 'true',
			...extra,
		},
	})
}
const wrangler = (args: string[]) => run(['exec', 'wrangler', ...args])
async function secretValues() {
	return z.record(z.string(), z.string()).parse(parseEnv(await readFile(secretsPath, 'utf8')))
}
async function saveSecrets(values: Record<string, string>) {
	await writeFile(
		secretsPath,
		Object.entries(values)
			.map(([key, value]) => `${key}=${JSON.stringify(value)}`)
			.join('\n') + '\n',
		{ mode: 0o600 },
	)
}
async function deploy(config: Partial<WorkerConfig>, values: Record<string, string>) {
	const secretFile = resolve(directory, 'deploy-secrets.json')
	await saveJson(configPath, config)
	await saveJson(secretFile, values)
	try {
		wrangler(['deploy', '--config', configPath, '--secrets-file', secretFile])
	} finally {
		await rm(secretFile, { force: true })
	}
}
async function waitFor(url: string, expected = 200) {
	for (let attempt = 0; attempt < 60; attempt++) {
		try {
			const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) })
			if (response.status === expected) return response
		} catch {
			/* New Workers and Pages aliases can take time to propagate. */
		}
		await new Promise((done) => setTimeout(done, 2000))
	}
	throw new Error(`Deployment did not become ready: ${url}`)
}
async function check(state: SandboxManifest) {
	await waitFor(`${state.api}/api/health`)
	await waitFor(`${state.dashboard}/api/health`)
	await waitFor(publicSite(state))
	const profile = await fetch(`${state.api}/api/me`)
	if (profile.status !== 401) throw new Error('Private API did not reject anonymous access')
	const dashboard = await fetch(state.dashboard, { redirect: 'manual' })
	if (
		![302, 307].includes(dashboard.status) ||
		!dashboard.headers.get('location')?.endsWith('/login')
	)
		throw new Error('Dashboard did not redirect anonymous access to login')
	const missing = await fetch(`${publicSite(state)}/does-not-exist`)
	if (missing.status !== 404) throw new Error('Custom 404 did not return HTTP 404')
	const home = await (await fetch(publicSite(state))).text()
	if (/noindex/.test(home) !== !state.domain)
		throw new Error('Marketing indexing setting did not match this deployment')
	const config = await (await fetch(`${state.api}/api/config`)).json()
	console.log(
		JSON.stringify(
			{
				marketing: publicSite(state),
				dashboard: state.dashboard,
				api: state.api,
				checks: 'health, app proxy, private API, dashboard protection, 404, indexing policy passed',
				googleConfigured: config.googleEnabled,
				stripeConfigured: config.checkoutEnabled,
				emailConfigured: config.emailEnabled,
				googleSignInVerified: false,
				stripeCardPaymentVerified: false,
				emailDeliveryVerified: false,
				googleCallback: `${state.dashboard}/api/auth/callback/google`,
				cleanup: `pnpm cloud:down ${slug}`,
			},
			null,
			2,
		),
	)
}
async function up(existing: SandboxManifest | null) {
	const { subdomain } = await cf.read('/workers/subdomain', subdomainSchema)
	const name = `starter-${slug}-${randomBytes(4).toString('hex')}`
	const state: SandboxManifest = existing ?? {
		kind: 'starter-sandbox-v1',
		account,
		name,
		databaseName: `${name}-db`,
		bucket: `${name}-files`,
		api: `https://${name}.${subdomain}.workers.dev`,
		dashboard: `https://${name}-dashboard.pages.dev`,
		marketing: `https://${name}-marketing.pages.dev`,
	}
	if (!subdomain) throw new Error('The Cloudflare account needs a workers.dev subdomain')
	if (!existing) await saveJson(manifestPath, state)
	if (!(await exists(secretsPath))) {
		// Never rotate signing secrets on a rerun or copy the local auth secret to the cloud.
		if (state.workerAttempted)
			throw new Error(
				'Stored sandbox secrets are missing; restore them before updating this deployment',
			)
		await saveSecrets({
			BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
			API_PROXY_SECRET: randomBytes(32).toString('hex'),
		})
	}
	const values = await secretValues()
	for (const key of [
		'GOOGLE_CLIENT_ID',
		'GOOGLE_CLIENT_SECRET',
		'STRIPE_SECRET_KEY',
		'STRIPE_PUBLISHABLE_KEY',
	])
		if (env[key]) {
			if (
				key.startsWith('STRIPE_') &&
				values[key] &&
				values[key] !== env[key] &&
				(await exists(stripeManifest))
			)
				throw new Error(
					'Stripe credentials changed while managed resources exist. Clean up with the original credentials before selecting another sandbox.',
				)
			values[key] = env[key]
		}
	await saveSecrets(values)
	const existingDatabases = await cf.read('/d1/database?per_page=1000', databases)
	let database = existingDatabases.find((item) => item.name === state.databaseName)
	if (!database) {
		state.databaseAttempted = true
		await saveJson(manifestPath, state)
		database = databaseSchema.parse(await cf('/d1/database', 'POST', { name: state.databaseName }))
	}
	state.databaseId = database.uuid
	await saveJson(manifestPath, state)
	if (!(await cf.read('/r2/buckets', buckets)).buckets.some((item) => item.name === state.bucket)) {
		state.bucketAttempted = true
		await saveJson(manifestPath, state)
		await cf('/r2/buckets', 'POST', { name: state.bucket })
	}
	for (const app of ['marketing', 'dashboard'] as const) {
		const project = `${state.name}-${app}`
		const settings = {
			production: {
				compatibility_date: '2026-10-01',
				env_vars: { API_PROXY_SECRET: { type: 'secret_text', value: values.API_PROXY_SECRET } },
			},
		}
		const current = await cf(`/pages/projects/${project}`, 'GET', undefined, true)
		state[`${app}Attempted`] = true
		await saveJson(manifestPath, state)
		if (!current)
			await cf('/pages/projects', 'POST', {
				name: project,
				production_branch: 'main',
				deployment_configs: settings,
			})
		else await cf(`/pages/projects/${project}`, 'PATCH', { deployment_configs: settings })
	}
	const config = workerConfig()
	Object.assign(config, {
		name: state.name,
		account_id: account,
		main: resolve(root, 'apps/api/src/index.ts'),
	})
	config.vars = {
		AUTH_URL: state.dashboard,
		ALLOWED_ORIGINS: [...new Set([state.marketing, publicSite(state), state.dashboard])].join(','),
		...(env.EMAIL_FROM ? { EMAIL_FROM: env.EMAIL_FROM } : {}),
	}
	config.d1_databases = [
		{
			binding: 'DB',
			database_name: state.databaseName,
			database_id: state.databaseId,
			migrations_dir: resolve(root, 'apps/api/migrations'),
		},
	]
	config.send_email = env.EMAIL_FROM
		? [{ name: 'EMAIL', allowed_sender_addresses: [env.EMAIL_FROM] }]
		: []
	config.r2_buckets = [{ binding: 'FILES', bucket_name: state.bucket }]
	await saveJson(configPath, config)
	wrangler(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', configPath])
	if (
		/^(sk|rk)_test_/.test(values.STRIPE_SECRET_KEY ?? '') &&
		values.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_') &&
		!values.STRIPE_WEBHOOK_SECRET
	) {
		if (env.STRIPE_PRICE_ID) {
			values.STRIPE_PRICE_ID = env.STRIPE_PRICE_ID
			await saveSecrets(values)
		}
		// The helper writes an owned-resource manifest before provisioning and captures
		// the signing secret directly. Existing prices are reused, never owned/deleted.
		run(
			[
				'stripe:setup',
				`${state.api}/api/stripe/webhook`,
				...(values.STRIPE_PRICE_ID ? ['--reuse-price'] : []),
			],
			{
				STARTER_ENV_FILE: secretsPath,
				STARTER_STRIPE_MANIFEST: stripeManifest,
				STRIPE_SECRET_KEY: values.STRIPE_SECRET_KEY,
				STRIPE_PUBLISHABLE_KEY: values.STRIPE_PUBLISHABLE_KEY,
				STRIPE_PRICE_ID: values.STRIPE_PRICE_ID ?? '',
				STRIPE_WEBHOOK_SECRET: '',
			},
		)
	}
	state.workerAttempted = true
	await saveJson(manifestPath, state)
	await deploy(config, await secretValues())
	for (const app of ['dashboard', 'marketing'] as const) {
		run(['--filter', app, 'build'], {
			VITE_API_URL: state.api,
			VITE_DASHBOARD_URL: state.dashboard,
			VITE_SITE_URL: publicSite(state),
			VITE_NOINDEX: String(!state.domain),
		})
		wrangler([
			'pages',
			'deploy',
			resolve(root, `apps/${app}/dist`),
			'--project-name',
			`${state.name}-${app}`,
			'--branch',
			'main',
			'--commit-dirty=true',
		])
	}
	await check(state)
}
async function down(state: SandboxManifest | null) {
	if (!state) throw new Error('No managed sandbox found; no resources were touched')
	// Only the resources named in this sandbox's validated manifest are eligible.
	await removeDomainDns(state, z.string().parse(token))
	for (const app of ['dashboard', 'marketing'] as const)
		if (state[`${app}Attempted`])
			await cf(`/pages/projects/${state.name}-${app}`, 'DELETE', undefined, true)
	if (await exists(stripeManifest)) {
		const values = await secretValues()
		run(['stripe:cleanup', stripeManifest], {
			STARTER_ENV_FILE: secretsPath,
			STRIPE_SECRET_KEY: values.STRIPE_SECRET_KEY,
			STRIPE_PUBLISHABLE_KEY: values.STRIPE_PUBLISHABLE_KEY,
		})
	}
	if ((await cf.read('/r2/buckets', buckets)).buckets.some((item) => item.name === state.bucket)) {
		// R2's management API cannot empty a bucket. During explicit teardown, replace
		// our owned Worker with a short-lived, secret-protected bucket-only cleanup worker.
		const cleanupToken = randomBytes(32).toString('hex')
		const cleanupSource = resolve(root, 'scripts/workers/empty-bucket.ts')
		state.workerAttempted = true
		await saveJson(manifestPath, state)
		await deploy(
			{
				name: state.name,
				account_id: account,
				main: cleanupSource,
				compatibility_date: '2026-10-01',
				workers_dev: true,
				r2_buckets: [{ binding: 'FILES', bucket_name: state.bucket }],
			},
			{ CLEANUP_TOKEN: cleanupToken },
		)
		let empty = false
		for (let attempt = 0; attempt < 180; attempt++) {
			const response = await fetch(state.api, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${cleanupToken}` },
				signal: AbortSignal.timeout(15000),
			})
			if (response.ok && (await response.json()).deleted === 0) {
				empty = true
				break
			}
			if (![200, 401, 404, 405].includes(response.status))
				throw new Error(`Bucket cleanup HTTP ${response.status}; rerun cloud:down`)
			await new Promise((done) => setTimeout(done, 1000))
		}
		if (!empty) throw new Error('Bucket is not empty yet; rerun cloud:down')
		await cf(`/r2/buckets/${state.bucket}`, 'DELETE', undefined, true)
	}
	const database = (await cf.read('/d1/database?per_page=1000', databases)).find(
		(item) => item.name === state.databaseName,
	)
	if (database) await cf(`/d1/database/${database.uuid}`, 'DELETE', undefined, true)
	if (state.workerAttempted) await cf(`/workers/scripts/${state.name}`, 'DELETE', undefined, true)
	for (const app of ['dashboard', 'marketing'] as const)
		if (await cf(`/pages/projects/${state.name}-${app}`, 'GET', undefined, true))
			throw new Error('Pages cleanup verification failed')
	if (
		(await cf.read('/d1/database?per_page=1000', databases)).some(
			(item) => item.name === state.databaseName,
		) ||
		(await cf.read('/r2/buckets', buckets)).buckets.some((item) => item.name === state.bucket) ||
		(await cf.read('/workers/scripts', workers)).some((item) => item.id === state.name)
	)
		throw new Error('Cleanup verification failed; keep the manifest and retry')
	await rm(directory, { recursive: true, force: true })
	console.log(
		'Verified: sandbox Pages, Worker, D1 and R2 resources are absent. Owned Stripe resources were cleaned up if configured.',
	)
}
try {
	const state = await readFile(manifestPath, 'utf8').then(
		(value) => sandboxManifest.parse(JSON.parse(value)),
		(error) => {
			if (hasCode(error, 'ENOENT')) return null
			throw error
		},
	)
	if (
		state &&
		(state.kind !== 'starter-sandbox-v1' ||
			state.account !== account ||
			!new RegExp(`^starter-${slug}-[a-f0-9]{8}$`).test(state.name) ||
			state.bucket !== `${state.name}-files` ||
			state.databaseName !== `${state.name}-db` ||
			state.dashboard !== `https://${state.name}-dashboard.pages.dev` ||
			state.marketing !== `https://${state.name}-marketing.pages.dev` ||
			!new RegExp(`^https://${state.name}\\.[a-z0-9-]+\\.workers\\.dev$`).test(state.api))
	)
		throw new Error('Invalid sandbox manifest or account mismatch')
	if (action === 'domain') {
		if (!state) throw new Error('Create the deployment with cloud:up first')
		await attachDomain(state, process.argv[4] ?? '', token, () => saveJson(manifestPath, state))
		await up(state)
	} else if (action === 'up') await up(state)
	else if (action === 'down') await down(state)
	else {
		if (!state) throw new Error('No managed sandbox found')
		await check(state)
	}
} catch (error) {
	console.error(
		`Sandbox ${action} failed. State is retained for retry or cleanup: pnpm cloud:down ${slug}`,
	)
	throw error
} finally {
	await rm(lock, { force: true })
}

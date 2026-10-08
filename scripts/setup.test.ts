import { serverPort } from './tooling.ts'
import type { Check } from './doctor.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { root } from './setup-env.ts'

function child(args: string[], env: NodeJS.ProcessEnv) {
	return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
		const childProcess = spawn(process.execPath, ['--import', 'tsx', ...args], {
			cwd: root,
			env,
			stdio: ['ignore', 'pipe', 'pipe'],
		})
		let output = ''
		childProcess.stdout.on('data', (chunk) => {
			output += chunk
		})
		childProcess.stderr.on('data', (chunk) => {
			output += chunk
		})
		childProcess.on('error', reject)
		childProcess.on('exit', (code) => resolve({ code, output }))
	})
}

test('doctor reports missing provider credentials without claiming live validation', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'starter-doctor-'))
	try {
		const result = await child(['scripts/doctor.ts', '--json', '--strict'], {
			PATH: process.env.PATH,
			STARTER_ENV_FILE: join(directory, 'missing.env'),
		})
		assert.equal(result.code, 1)
		const output: {
			providerSignInVerified: boolean
			cardPaymentVerified: boolean
			checks: Check[]
		} = JSON.parse(result.output)
		assert.equal(output.providerSignInVerified, false)
		assert.equal(output.cardPaymentVerified, false)
		assert.equal(output.checks.filter((entry) => entry.status === 'missing').length, 5)
	} finally {
		await rm(directory, { recursive: true, force: true })
	}
})

for (const mode of ['new', 'reuse', 'webhook-failure']) {
	test(`Stripe resource setup/cleanup: ${mode}`, async () => {
		const directory = await mkdtemp(join(tmpdir(), 'starter-stripe-setup-'))
		const envFile = join(directory, 'secrets.env')
		const manifestFile = join(directory, 'stripe.json')
		const objects = new Map<
			string,
			{ id: string; object?: string; active?: boolean; secret?: string; deleted?: boolean }
		>([['price_existing', { id: 'price_existing', object: 'price', active: true }]])
		const calls: string[] = []
		const server = createServer(async (request, response) => {
			const chunks = []
			for await (const chunk of request) chunks.push(chunk)
			const fields = new URLSearchParams(Buffer.concat(chunks).toString())
			const path = new URL(request.url ?? '/', 'http://fixture').pathname
			calls.push(`${request.method} ${path}`)
			response.setHeader('Content-Type', 'application/json')
			if (request.headers.authorization !== 'Bearer sk_test_setup_fixture') {
				response.writeHead(401)
				return response.end(JSON.stringify({ error: { message: 'Unexpected test key' } }))
			}
			if (
				mode === 'webhook-failure' &&
				path === '/v1/webhook_endpoints' &&
				request.method === 'POST'
			) {
				response.writeHead(400)
				return response.end(
					JSON.stringify({
						error: { type: 'invalid_request_error', message: 'Injected webhook failure' },
					}),
				)
			}
			const match = path.match(/^\/v1\/(products|prices|webhook_endpoints)(?:\/([^/]+))?$/)
			if (!match) {
				response.writeHead(404)
				return response.end('{}')
			}
			const [, collection, id] = match
			let object = objects.get(id)
			if (request.method === 'POST' && !id) {
				const prefix = collection === 'products' ? 'prod' : collection === 'prices' ? 'price' : 'we'
				object = { id: `${prefix}_fixture`, object: collection.slice(0, -1), active: true }
				if (collection === 'webhook_endpoints') {
					assert.equal(fields.get('url'), 'https://sandbox.example/api/stripe/webhook')
					object.secret = 'whsec_fixture_webhook'
				}
				objects.set(object.id, object)
			} else if (request.method === 'POST' && object)
				object.active = fields.get('active') === 'true'
			else if (request.method === 'DELETE' && object) {
				objects.delete(id)
				object = { id, deleted: true }
			}
			if (!object) {
				response.writeHead(404)
				return response.end(JSON.stringify({ error: { code: 'resource_missing' } }))
			}
			response.end(JSON.stringify(object))
		})
		await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
		const port = serverPort(server)
		// Test-only process preload; production setup has no mock transport option.
		const preload = join(root, 'scripts/fixtures/stripe-transport.ts')
		await writeFile(
			envFile,
			'STRIPE_SECRET_KEY=sk_test_setup_fixture\nSTRIPE_PUBLISHABLE_KEY=pk_test_fixture\n' +
				(mode === 'reuse' ? 'STRIPE_PRICE_ID=price_existing\n' : ''),
			{ mode: 0o600 },
		)
		const env = {
			PATH: process.env.PATH,
			STARTER_ENV_FILE: envFile,
			STARTER_STRIPE_MANIFEST: manifestFile,
			TEST_STRIPE_ORIGIN: `http://127.0.0.1:${port}`,
		}
		try {
			const setup = await child(
				[
					'--import',
					preload,
					'scripts/stripe-demo.ts',
					'setup',
					'https://sandbox.example/api/stripe/webhook',
					...(mode === 'reuse' ? ['--reuse-price'] : []),
				],
				env,
			)
			assert.equal(setup.code, mode === 'webhook-failure' ? 1 : 0, setup.output)
			assert.ok(!setup.output.includes('sk_test_setup_fixture'))
			assert.ok(!setup.output.includes('whsec_fixture_webhook'))
			if (mode !== 'webhook-failure') {
				const values = parseEnv(await readFile(envFile, 'utf8'))
				assert.equal(values.STRIPE_WEBHOOK_SECRET, 'whsec_fixture_webhook')
				assert.equal(values.STRIPE_PRICE_ID, mode === 'reuse' ? 'price_existing' : 'price_fixture')
				const duplicate = await child(
					[
						'--import',
						preload,
						'scripts/stripe-demo.ts',
						'setup',
						'https://sandbox.example/api/stripe/webhook',
						'--reuse-price',
					],
					env,
				)
				assert.equal(duplicate.code, 1)
				const cleanup = await child(
					['--import', preload, 'scripts/stripe-demo.ts', 'cleanup', manifestFile],
					env,
				)
				assert.equal(cleanup.code, 0, cleanup.output)
				assert.equal(objects.has('we_fixture'), false)
				const clean = parseEnv(await readFile(envFile, 'utf8'))
				assert.equal(clean.STRIPE_WEBHOOK_SECRET, undefined)
				assert.equal(clean.STRIPE_PRICE_ID, mode === 'reuse' ? 'price_existing' : undefined)
			}
			assert.equal(objects.get('price_existing')?.active, true)
			if (mode === 'reuse')
				assert.equal(
					calls.some((call) => /POST \/v1\/(products|prices)/.test(call)),
					false,
				)
			else {
				assert.equal(objects.get('price_fixture')?.active, false)
				assert.equal(objects.get('prod_fixture')?.active, false)
			}
			await assert.rejects(readFile(manifestFile), { code: 'ENOENT' })
		} finally {
			await new Promise((done) => server.close(done))
			await rm(directory, { recursive: true, force: true })
		}
	})
}

for (const mode of ['new', 'existing', 'wrong-zone', 'denied']) {
	test(`Email domain API setup: ${mode}`, async () => {
		const directory = await mkdtemp(join(tmpdir(), 'starter-email-setup-'))
		try {
			const preload = join(root, 'scripts/fixtures/email-transport.ts')
			const result = await child(['--import', preload, 'scripts/email-domain.ts', 'setup'], {
				PATH: process.env.PATH,
				STARTER_ENV_FILE: join(directory, 'missing.env'),
				CLOUDFLARE_API_TOKEN: 'email-fixture-token',
				TEST_EMAIL_MODE: mode,
				CLOUDFLARE_ZONE_ID: 'a'.repeat(32),
				CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32),
				EMAIL_FROM: mode === 'wrong-zone' ? 'hello@other.test' : 'hello@mail.example.test',
			})
			assert.equal(result.code, ['new', 'existing'].includes(mode) ? 0 : 1, result.output)
			assert.ok(!result.output.includes('email-fixture-token'))
			if (result.code === 0) {
				const data = JSON.parse(result.output)
				assert.equal(data.enabled, true)
				assert.equal(data.inboxDeliveryVerified, false)
			}
		} finally {
			await rm(directory, { recursive: true, force: true })
		}
	})
}

for (const badScope of [false, true]) {
	test(`PostHog agent setup is scoped and repeatable: ${badScope ? 'wrong project' : 'setup and report'}`, async () => {
		const directory = await mkdtemp(join(tmpdir(), 'starter-posthog-'))
		const statePath = join(directory, 'state.json')
		const file = join(directory, 'config.env')
		await writeFile(
			statePath,
			JSON.stringify({ projects: [], dashboards: [], insights: [], writes: 0 }),
		)
		const env: NodeJS.ProcessEnv = {
			PATH: process.env.PATH,
			STARTER_ENV_FILE: file,
			TEST_POSTHOG_STATE: statePath,
			POSTHOG_PERSONAL_API_KEY: 'phx_fixture_private',
			POSTHOG_MANAGEMENT_HOST: 'https://eu.posthog.com',
			POSTHOG_ORGANIZATION_ID: 'd2187fbd-d74f-45ab-bf16-9bb9e8c2bf46',
			...(badScope ? { TEST_POSTHOG_BAD_SCOPE: 'true', POSTHOG_PROJECT_ID: '123' } : {}),
		}
		const args = ['--import', './scripts/fixtures/posthog-transport.ts', 'scripts/posthog.ts']
		try {
			const first = await child([...args, 'setup'], env)
			assert.equal(first.code, badScope ? 1 : 0, first.output)
			if (badScope) {
				assert.match(first.output, /scope mismatch/)
				assert.equal(JSON.parse(await readFile(statePath, 'utf8')).writes, 0)
			} else {
				const second = await child([...args, 'setup'], env)
				assert.equal(second.code, 0, second.output)
				const state = JSON.parse(await readFile(statePath, 'utf8'))
				assert.equal(state.projects.length, 1)
				assert.equal(state.dashboards.length, 1)
				assert.equal(state.insights.length, 3)
				const config = await readFile(file, 'utf8')
				assert.match(config, /POSTHOG_KEY="phc_fixture"/)
				assert.doesNotMatch(config, /phx_fixture_private/)
				const report = await child([...args, 'report'], env)
				assert.equal(report.code, 0, report.output)
				assert.equal(JSON.parse(report.output).reports.length, 3)
			}
		} finally {
			await rm(directory, { recursive: true, force: true })
		}
	})
}

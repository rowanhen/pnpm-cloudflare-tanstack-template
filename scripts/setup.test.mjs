import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { root } from './setup-env.mjs'

function child(args, env) {
	return new Promise((resolve, reject) => {
		const process = spawn('node', args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
		let output = ''
		process.stdout.on('data', (chunk) => {
			output += chunk
		})
		process.stderr.on('data', (chunk) => {
			output += chunk
		})
		process.on('error', reject)
		process.on('exit', (code) => resolve({ code, output }))
	})
}

test('doctor reports missing provider credentials without claiming live validation', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'starter-doctor-'))
	try {
		const result = await child(['scripts/doctor.mjs', '--json', '--strict'], {
			PATH: process.env.PATH,
			STARTER_ENV_FILE: join(directory, 'missing.env'),
		})
		assert.equal(result.code, 1)
		const output = JSON.parse(result.output)
		assert.equal(output.providerSignInVerified, false)
		assert.equal(output.cardPaymentVerified, false)
		assert.equal(output.checks.filter((entry) => entry.status === 'missing').length, 3)
	} finally {
		await rm(directory, { recursive: true, force: true })
	}
})

for (const mode of ['new', 'reuse', 'webhook-failure']) {
	test(`Stripe resource setup/cleanup: ${mode}`, async () => {
		const directory = await mkdtemp(join(tmpdir(), 'starter-stripe-setup-'))
		const envFile = join(directory, 'secrets.env')
		const manifestFile = join(directory, 'stripe.json')
		const objects = new Map([
			['price_existing', { id: 'price_existing', object: 'price', active: true }],
		])
		const calls = []
		const server = createServer(async (request, response) => {
			const chunks = []
			for await (const chunk of request) chunks.push(chunk)
			const fields = new URLSearchParams(Buffer.concat(chunks).toString())
			const path = new URL(request.url, 'http://fixture').pathname
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
				const prefix = { products: 'prod', prices: 'price', webhook_endpoints: 'we' }[collection]
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
		await new Promise((done) => server.listen(0, '127.0.0.1', done))
		const port = server.address().port
		// Test-only process preload; production setup has no mock transport option.
		const preload = join(directory, 'transport.mjs')
		await writeFile(
			preload,
			`const original = globalThis.fetch; globalThis.fetch = (input, init) => {
			const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
			if (url.hostname !== 'api.stripe.com') throw new Error('Unexpected network host');
			return original('http://127.0.0.1:${port}' + url.pathname + url.search, init);
		};`,
		)
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
		}
		try {
			const setup = await child(
				[
					'--import',
					preload,
					'scripts/stripe-demo.mjs',
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
						'scripts/stripe-demo.mjs',
						'setup',
						'https://sandbox.example/api/stripe/webhook',
						'--reuse-price',
					],
					env,
				)
				assert.equal(duplicate.code, 1)
				const cleanup = await child(
					['--import', preload, 'scripts/stripe-demo.mjs', 'cleanup', manifestFile],
					env,
				)
				assert.equal(cleanup.code, 0, cleanup.output)
				assert.equal(objects.has('we_fixture'), false)
				const clean = parseEnv(await readFile(envFile, 'utf8'))
				assert.equal(clean.STRIPE_WEBHOOK_SECRET, undefined)
				assert.equal(clean.STRIPE_PRICE_ID, mode === 'reuse' ? 'price_existing' : undefined)
			}
			assert.equal(objects.get('price_existing').active, true)
			if (mode === 'reuse')
				assert.equal(
					calls.some((call) => /POST \/v1\/(products|prices)/.test(call)),
					false,
				)
			else {
				assert.equal(objects.get('price_fixture').active, false)
				assert.equal(objects.get('prod_fixture').active, false)
			}
			await assert.rejects(readFile(manifestFile), { code: 'ENOENT' })
		} finally {
			await new Promise((done) => server.close(done))
			await rm(directory, { recursive: true, force: true })
		}
	})
}

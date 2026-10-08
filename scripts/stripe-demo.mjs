import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const require = createRequire(new URL('../apps/api/package.json', import.meta.url))
const Stripe = require('stripe')
const root = fileURLToPath(new URL('..', import.meta.url))
const varsPath = join(root, 'apps/api/.dev.vars')
const original = await readFile(varsPath, 'utf8').catch(() => '')
const env = { ...parseEnv(original), ...process.env }
if (
	!/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? '') ||
	!env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')
)
	throw new Error('Add Stripe test-mode secret and publishable keys to apps/api/.dev.vars first.')
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 })
const mode = process.argv[2] ?? 'setup'
const hash = (value) => createHash('sha256').update(value).digest('hex')
async function saveVars(values) {
	let content = await readFile(varsPath, 'utf8').catch(() => '')
	for (const [key, value] of Object.entries(values)) {
		content = content
			.split('\n')
			.filter((line) => !line.startsWith(`${key}=`))
			.join('\n')
		if (value !== null) content = content.trimEnd() + `\n${key}=${JSON.stringify(value)}\n`
	}
	await writeFile(varsPath, content, { mode: 0o600 })
}
async function cleanup(manifest) {
	if (manifest.webhook) {
		try {
			await stripe.webhookEndpoints.del(manifest.webhook)
		} catch (error) {
			if (error.code !== 'resource_missing') throw error
		}
	}
	if (manifest.price) {
		await stripe.prices.update(manifest.price, { active: false })
		if ((await stripe.prices.retrieve(manifest.price)).active)
			throw new Error('Price cleanup failed')
	}
	if (manifest.product) {
		await stripe.products.update(manifest.product, { active: false })
		if ((await stripe.products.retrieve(manifest.product)).active)
			throw new Error('Product cleanup failed')
	}
	const current = parseEnv(await readFile(varsPath, 'utf8').catch(() => ''))
	const remove = {}
	if (current.STRIPE_PRICE_ID === manifest.price) remove.STRIPE_PRICE_ID = null
	if (
		manifest.webhookSecretHash &&
		hash(current.STRIPE_WEBHOOK_SECRET ?? '') === manifest.webhookSecretHash
	)
		remove.STRIPE_WEBHOOK_SECRET = null
	if (Object.keys(remove).length) await saveVars(remove)
}
if (mode === 'cleanup') {
	const path = process.argv[3]
	if (!path) throw new Error('Usage: pnpm stripe:cleanup .wrangler/stripe-demo-ID.json')
	const manifest = JSON.parse(await readFile(path, 'utf8'))
	if (manifest.kind !== 'starter-stripe-demo')
		throw new Error('Not a starter Stripe resource manifest')
	await cleanup(manifest)
	await rm(path)
	console.log(
		'Demo price/product archived, webhook removed, and matching local bindings cleared. Existing test payment history is retained by Stripe.',
	)
} else if (mode === 'setup') {
	if (env.STRIPE_PRICE_ID)
		throw new Error(
			'A Stripe price is already configured. Reuse it, or clean up the previous demo first.',
		)
	const webhookUrl = process.argv[3]
	if (webhookUrl) {
		const url = new URL(webhookUrl)
		if (
			url.protocol !== 'https:' ||
			url.pathname !== '/api/stripe/webhook' ||
			url.username ||
			url.password ||
			url.search
		)
			throw new Error('Use the public HTTPS API Worker URL ending in /api/stripe/webhook')
	}
	const id = randomUUID()
	const path = join(root, '.wrangler', `stripe-demo-${id}.json`)
	const manifest = { kind: 'starter-stripe-demo', id }
	await mkdir(join(root, '.wrangler'), { recursive: true })
	const save = () => writeFile(path, JSON.stringify(manifest, null, 2), { mode: 0o600 })
	await save()
	try {
		const product = await stripe.products.create(
			{
				name: 'Starter pass',
				metadata: { starter_demo: id },
			},
			{ idempotencyKey: `starter-product-${id}` },
		)
		manifest.product = product.id
		await save()
		const price = await stripe.prices.create(
			{ product: product.id, unit_amount: 1200, currency: 'gbp', metadata: { starter_demo: id } },
			{ idempotencyKey: `starter-price-${id}` },
		)
		manifest.price = price.id
		await save()
		const values = { STRIPE_PRICE_ID: price.id }
		if (webhookUrl) {
			const webhook = await stripe.webhookEndpoints.create(
				{
					url: webhookUrl,
					enabled_events: [
						'checkout.session.completed',
						'checkout.session.expired',
						'checkout.session.async_payment_succeeded',
						'checkout.session.async_payment_failed',
					],
					api_version: '2026-09-30.endive',
					metadata: { starter_demo: id },
				},
				{ idempotencyKey: `starter-webhook-${id}` },
			)
			manifest.webhook = webhook.id
			manifest.webhookSecretHash = hash(webhook.secret)
			await save()
			values.STRIPE_WEBHOOK_SECRET = webhook.secret
		}
		await saveVars(values)
		console.log(
			`Test product and £12 price created. Local bindings saved without displaying secrets.\nResource manifest: ${path}`,
		)
		if (!webhookUrl)
			console.log(
				'Next: run stripe listen --forward-to localhost:8787/api/stripe/webhook and save its signing secret as STRIPE_WEBHOOK_SECRET in apps/api/.dev.vars. Restart pnpm dev.',
			)
	} catch (error) {
		try {
			await cleanup(manifest)
			await rm(path)
		} catch {
			console.error(`Cleanup needs attention. Keep this manifest: ${path}`)
		}
		throw error
	}
} else throw new Error('Use setup or cleanup')

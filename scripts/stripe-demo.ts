import Stripe from 'stripe'
import { stripeManifest, type StripeManifest } from './resource-manifests.ts'
import { hasCode } from './tooling.ts'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const root = fileURLToPath(new URL('..', import.meta.url))
const varsPath = process.env.STARTER_ENV_FILE ?? join(root, 'apps/api/.dev.vars')
const original = await readFile(varsPath, 'utf8').catch(() => '')
const env = { ...parseEnv(original), ...process.env }
if (
	!env.STRIPE_SECRET_KEY ||
	!/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY) ||
	!env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')
)
	throw new Error('Add Stripe test-mode secret and publishable keys to apps/api/.dev.vars first.')
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
	maxNetworkRetries: 2,
	httpClient: Stripe.createFetchHttpClient(),
})
const mode = process.argv[2] ?? 'setup'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
async function saveVars(values: Record<string, string | null>) {
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
async function cleanup(manifest: StripeManifest) {
	if (manifest.webhook) {
		try {
			await stripe.webhookEndpoints.del(manifest.webhook)
		} catch (error) {
			if (!hasCode(error, 'resource_missing')) throw error
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
	const remove: Record<string, null> = {}
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
	const manifest = stripeManifest.parse(JSON.parse(await readFile(path, 'utf8')))
	if (manifest.kind !== 'starter-stripe-demo')
		throw new Error('Not a starter Stripe resource manifest')
	await cleanup(manifest)
	await rm(path)
	console.log(
		'Demo price/product archived, webhook removed, and matching local bindings cleared. Existing test payment history is retained by Stripe.',
	)
} else if (mode === 'setup') {
	if (env.STRIPE_PRICE_ID && !process.argv.includes('--reuse-price'))
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
	const path =
		process.env.STARTER_STRIPE_MANIFEST ?? join(root, '.wrangler', `stripe-demo-${id}.json`)
	if (
		await readFile(path).then(
			() => true,
			(error) => {
				if (hasCode(error, 'ENOENT')) return false
				throw error
			},
		)
	)
		throw new Error(
			'A Stripe manifest already exists; finish its cleanup before creating resources again.',
		)
	const manifest: StripeManifest = { kind: 'starter-stripe-demo', id }
	await mkdir(join(root, '.wrangler'), { recursive: true })
	const save = () => writeFile(path, JSON.stringify(manifest, null, 2), { mode: 0o600 })
	await save()
	try {
		if (!env.STRIPE_PRICE_ID) {
			const product = await stripe.products.create(
				{
					name: 'API credits',
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
		}
		const priceId = manifest.price ?? env.STRIPE_PRICE_ID
		if (!priceId) throw new Error('A price must be created or reused')
		const values: Record<string, string> = { STRIPE_PRICE_ID: priceId }
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
			if (!webhook.secret) throw new Error('Stripe did not return a webhook signing secret')
			manifest.webhook = webhook.id
			manifest.webhookSecretHash = hash(webhook.secret)
			await save()
			values.STRIPE_WEBHOOK_SECRET = webhook.secret
		}
		await saveVars(values)
		console.log(
			`Test price configured. Local bindings saved without displaying secrets.\nResource manifest: ${path}`,
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

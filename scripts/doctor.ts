import { posthogEnv } from './posthog-env.ts'
import { setupEnv } from './setup-env.ts'

const env = await setupEnv()
export interface Check {
	name: string
	status: 'ready' | 'missing' | 'configured' | 'blocked'
	detail: string
}
const checks: Check[] = []
function add(name: string, status: Check['status'], detail: string) {
	checks.push({ name, status, detail })
}
add(
	'node',
	Number(process.versions.node.split('.')[0]) > 22 ||
		(Number(process.versions.node.split('.')[0]) === 22 &&
			Number(process.versions.node.split('.')[1]) >= 12)
		? 'ready'
		: 'missing',
	`Node ${process.versions.node}; requires 22.12+`,
)
add(
	'cloudflare',
	env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN ? 'configured' : 'missing',
	'Account ID and API token with Workers, D1, R2 and Pages edit access',
)
add(
	'auth-secret',
	(env.BETTER_AUTH_SECRET?.length ?? 0) >= 32 ? 'configured' : 'missing',
	'At least 32 characters; pnpm setup:local generates a local secret',
)
add(
	'google',
	env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
		? env.GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com')
			? 'configured'
			: 'blocked'
		: 'missing',
	'Google web OAuth client; local callback: http://localhost:3001/api/auth/callback/google. Allowlist and real sign-in require a browser check',
)
add(
	'stripe',
	/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? '') &&
		env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')
		? 'configured'
		: env.STRIPE_SECRET_KEY || env.STRIPE_PUBLISHABLE_KEY
			? 'blocked'
			: 'missing',
	'Stripe test secret + publishable key; cloud:up can create the product, price and webhook',
)
add(
	'stripe-price',
	env.STRIPE_PRICE_ID
		? /^price_[A-Za-z0-9]+$/.test(env.STRIPE_PRICE_ID)
			? 'configured'
			: 'blocked'
		: 'missing',
	'Local checkout needs an active one-time test price; run pnpm stripe:setup after adding test keys',
)
add(
	'stripe-webhook',
	env.STRIPE_WEBHOOK_SECRET
		? env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')
			? 'configured'
			: 'blocked'
		: 'missing',
	'Local listener signing secret: stripe listen --forward-to localhost:8787/api/stripe/webhook. Cloud setup creates its own endpoint secret',
)
add(
	'email',
	env.EMAIL_FROM ? 'configured' : 'missing',
	'EMAIL_FROM on a Cloudflare Email Service domain; configuration is not proof of inbox delivery',
)
try {
	const config = posthogEnv(env)
	add(
		'posthog',
		config.key ? 'configured' : 'missing',
		'Public project token + regional ingestion host; ingestion and replay are not verified by presence',
	)
} catch {
	add('posthog', 'blocked', 'Use a phc_ project token and matching PostHog Cloud ingestion host')
}
if (process.argv.includes('--online')) {
	if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
		try {
			const response = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/subdomain`,
				{
					headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
					signal: AbortSignal.timeout(15000),
				},
			)
			const body = await response.json()
			add(
				'cloudflare-api',
				response.ok && body.success && body.result?.subdomain ? 'ready' : 'blocked',
				`Workers API HTTP ${response.status}; resource-specific permissions are checked during provisioning`,
			)
		} catch {
			add('cloudflare-api', 'blocked', 'Cloudflare API could not be reached')
		}
	}
	if (/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? '')) {
		try {
			const response = await fetch('https://api.stripe.com/v1/prices?limit=1', {
				headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
				signal: AbortSignal.timeout(15000),
			})
			add(
				'stripe-api',
				response.ok ? 'ready' : 'blocked',
				`Prices API HTTP ${response.status}; does not verify card payment or publishable-key account matching`,
			)
		} catch {
			add('stripe-api', 'blocked', 'Stripe API could not be reached')
		}
		if (/^price_[A-Za-z0-9]+$/.test(env.STRIPE_PRICE_ID ?? '')) {
			try {
				const response = await fetch(`https://api.stripe.com/v1/prices/${env.STRIPE_PRICE_ID}`, {
					headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
					signal: AbortSignal.timeout(15000),
				})
				const price = response.ok ? await response.json() : undefined
				add(
					'stripe-price-api',
					response.ok &&
						price.active === true &&
						price.livemode === false &&
						price.type === 'one_time' &&
						Number.isInteger(price.unit_amount) &&
						price.unit_amount > 0
						? 'ready'
						: 'blocked',
					`Price API HTTP ${response.status}; requires an active, nonzero, one-time test price accessible with this secret key`,
				)
			} catch {
				add('stripe-price-api', 'blocked', 'Stripe price could not be checked')
			}
		}
	}
}
if (process.argv.includes('--json'))
	console.log(
		JSON.stringify(
			{
				checks,
				providerSignInVerified: false,
				cardPaymentVerified: false,
				emailDeliveryVerified: false,
				posthogIngestionVerified: false,
				posthogReplayVerified: false,
			},
			null,
			2,
		),
	)
else {
	for (const check of checks)
		console.log(`${check.status.toUpperCase().padEnd(10)} ${check.name}: ${check.detail}`)
	console.log(
		'\nAccount setup and reuse: docs/provider-setup.md\nValidate without provider credentials: pnpm validate\nValidate disposable cloud resources: pnpm test:remote\nCreate an online sandbox: pnpm cloud:up my-demo',
	)
}
if (
	process.argv.includes('--strict') &&
	checks.some((check) => ['missing', 'blocked'].includes(check.status))
)
	process.exitCode = 1

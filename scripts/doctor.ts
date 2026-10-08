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
	'google',
	env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? 'configured' : 'missing',
	'Standard web OAuth client; callback allowlist and real sign-in are not verified by credential presence',
)
add(
	'stripe',
	/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? '') &&
		env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')
		? 'configured'
		: 'missing',
	'Stripe test secret + publishable key; cloud:up can create the product, price and webhook',
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
		'\nValidate without provider credentials: pnpm validate\nValidate disposable cloud resources: pnpm test:remote\nCreate an online sandbox: pnpm cloud:up my-demo',
	)
}
if (
	process.argv.includes('--strict') &&
	checks.some((check) => ['missing', 'blocked'].includes(check.status))
)
	process.exitCode = 1

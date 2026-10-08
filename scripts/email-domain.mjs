import { setupEnv } from './setup-env.mjs'

const env = await setupEnv()
const action = process.argv[2]
if (!['setup', 'check'].includes(action)) throw new Error('Use email:setup or email:check')
if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ZONE_ID ?? '') || !env.CLOUDFLARE_API_TOKEN)
	throw new Error(
		'Set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN with Email Sending and zone read access',
	)
if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.EMAIL_FROM ?? ''))
	throw new Error('Set EMAIL_FROM to the sender address you want to configure')
const domain = env.EMAIL_FROM.split('@')[1].toLowerCase()
const path = `/zones/${env.CLOUDFLARE_ZONE_ID}`
async function api(endpoint, method = 'GET', body) {
	const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
		method,
		headers: {
			Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: body ? JSON.stringify(body) : undefined,
		signal: AbortSignal.timeout(30000),
	})
	const result = await response.json()
	if (!response.ok || !result.success)
		throw new Error(
			`Cloudflare ${method} ${endpoint}: HTTP ${response.status}; ${result.errors?.map((error) => `${error.code}: ${error.message}`).join('; ') ?? 'request failed'}`,
		)
	return result.result
}
const zone = await api(path)
if (domain !== zone.name && !domain.endsWith(`.${zone.name}`))
	throw new Error('EMAIL_FROM must belong to CLOUDFLARE_ZONE_ID')
if (env.CLOUDFLARE_ACCOUNT_ID && zone.account.id !== env.CLOUDFLARE_ACCOUNT_ID)
	throw new Error('Zone belongs to a different Cloudflare account')
const domains = await api(`${path}/email/sending/subdomains`)
let sender = domains.find((value) => value.name === domain)
if (action === 'setup' && !sender?.enabled)
	sender = await api(`${path}/email/sending/subdomains`, 'POST', { name: domain })
console.log(
	JSON.stringify(
		{
			domain,
			enabled: sender?.enabled ?? false,
			dkimSelector: sender?.dkim_selector ?? null,
			returnPathDomain: sender?.return_path_domain ?? null,
			inboxDeliveryVerified: false,
		},
		null,
		2,
	),
)
if (!sender?.enabled) process.exitCode = 1
// The sender domain is shared account configuration and is deliberately retained.
// cloud:down removes the project's binding and delivery records, not domain DNS.

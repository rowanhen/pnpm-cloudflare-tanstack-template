import { z } from 'zod'
import { cloudflareApi } from './cloudflare-api.ts'
import { setupEnv } from './setup-env.ts'

const env = await setupEnv()
const action = process.argv[2]
if (!['setup', 'check'].includes(action)) throw new Error('Use email:setup or email:check')
if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ZONE_ID ?? '') || !env.CLOUDFLARE_API_TOKEN)
	throw new Error(
		'Set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN with Email Sending and zone read access',
	)
if (!env.EMAIL_FROM || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.EMAIL_FROM))
	throw new Error('Set EMAIL_FROM to the sender address you want to configure')
const domain = env.EMAIL_FROM.split('@')[1].toLowerCase()
const path = `/zones/${env.CLOUDFLARE_ZONE_ID}`
const api = cloudflareApi(env.CLOUDFLARE_API_TOKEN)
const senderSchema = z.object({
	name: z.string(),
	enabled: z.boolean(),
	dkim_selector: z.string().nullish(),
	return_path_domain: z.string().nullish(),
})
const zone = await api.read(
	path,
	z.object({ name: z.string(), account: z.object({ id: z.string() }) }),
)
if (domain !== zone.name && !domain.endsWith(`.${zone.name}`))
	throw new Error('EMAIL_FROM must belong to CLOUDFLARE_ZONE_ID')
if (env.CLOUDFLARE_ACCOUNT_ID && zone.account.id !== env.CLOUDFLARE_ACCOUNT_ID)
	throw new Error('Zone belongs to a different Cloudflare account')
const domains = await api.read(`${path}/email/sending/subdomains`, z.array(senderSchema))
let sender = domains.find((value) => value.name === domain)
if (action === 'setup' && !sender?.enabled)
	sender = senderSchema.parse(
		await api(`${path}/email/sending/subdomains`, 'POST', { name: domain }),
	)
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

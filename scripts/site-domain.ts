import { z } from 'zod'
import { cloudflareApi } from './cloudflare-api.ts'
import type { SandboxManifest } from './resource-manifests.ts'

const records = z.array(
	z.object({ id: z.string(), type: z.string(), name: z.string(), content: z.string() }),
)
const zones = z.array(
	z.object({ id: z.string(), name: z.string(), account: z.object({ id: z.string() }) }),
)
const domains = z.array(z.object({ name: z.string() }))
export const publicSite = (state: SandboxManifest) =>
	state.domain ? `https://${state.domain.hostname}` : state.marketing

export async function attachDomain(
	state: SandboxManifest,
	hostname: string,
	token: string,
	save: () => Promise<void>,
) {
	if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(hostname))
		throw new Error('Use a subdomain such as devtemplate.example.com')
	if (state.domain && state.domain.hostname !== hostname)
		throw new Error('This deployment already owns a different domain')
	const api = cloudflareApi(token)
	const available = await api.read(`/zones?account.id=${state.account}&per_page=50`, zones)
	const zone = available
		.filter((zone) => hostname.endsWith(`.${zone.name}`) && zone.account.id === state.account)
		.sort((a, b) => b.name.length - a.name.length)[0]
	if (!zone) throw new Error('No matching Cloudflare zone in this account')
	const target = new URL(state.marketing).hostname
	const path = `/zones/${zone.id}/dns_records`
	const existing = await api.read(`${path}?name=${hostname}`, records)
	if (existing.some((record) => record.type !== 'CNAME' || record.content !== target))
		throw new Error('The hostname has an existing DNS record for another service')
	state.domain ??= { hostname, zoneId: zone.id, dnsCreated: existing.length === 0 }
	await save()
	const pages = `/accounts/${state.account}/pages/projects/${state.name}-marketing/domains`
	if (!(await api.read(pages, domains)).some((domain) => domain.name === hostname))
		await api(pages, 'POST', { name: hostname })
	const record =
		existing[0] ??
		records.element.parse(
			await api(path, 'POST', {
				type: 'CNAME',
				name: hostname,
				content: target,
				proxied: true,
				ttl: 1,
			}),
		)
	state.domain.dnsRecordId = record.id
	await save()
}

export async function removeDomainDns(state: SandboxManifest, token: string) {
	if (!state.domain?.dnsCreated) return
	const api = cloudflareApi(token)
	const { hostname, zoneId, dnsRecordId } = state.domain
	const path = `/zones/${zoneId}/dns_records`
	const current = await api.read(`${path}?name=${hostname}`, records)
	for (const record of current) {
		if (
			record.type !== 'CNAME' ||
			record.content !== new URL(state.marketing).hostname ||
			(dnsRecordId && record.id !== dnsRecordId)
		)
			throw new Error('Domain DNS changed outside this project; review before cleanup')
		await api(`${path}/${record.id}`, 'DELETE')
	}
	if ((await api.read(`${path}?name=${hostname}`, records)).length)
		throw new Error('Domain DNS cleanup verification failed')
}

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attachDomain, removeDomainDns } from './site-domain.ts'
import type { SandboxManifest } from './resource-manifests.ts'

const hostname = 'devtemplate.example.test'
const target = 'starter-test-12345678-marketing.pages.dev'
const record = { id: 'record-1', type: 'CNAME', name: hostname, content: target }

for (const mode of ['create', 'reuse', 'conflict', 'changed'] as const) {
	test(`Custom domain ownership: ${mode}`, async () => {
		const state: SandboxManifest = {
			kind: 'starter-sandbox-v1',
			account: 'a'.repeat(32),
			name: 'starter-test-12345678',
			databaseName: 'starter-test-12345678-db',
			bucket: 'starter-test-12345678-files',
			api: 'https://starter-test-12345678.example.workers.dev',
			dashboard: 'https://starter-test-12345678-dashboard.pages.dev',
			marketing: `https://${target}`,
		}
		let dns =
			mode === 'reuse'
				? [{ ...record }]
				: mode === 'conflict'
					? [{ ...record, content: 'another-service.example.test' }]
					: []
		let attached = false
		let created = 0
		let deleted = 0
		let saved = 0
		const original = globalThis.fetch
		globalThis.fetch = async (input, init = {}) => {
			const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
			assert.equal(url.hostname, 'api.cloudflare.com')
			const method = init.method ?? 'GET'
			let result: unknown
			if (url.pathname === '/client/v4/zones')
				result = [{ id: 'b'.repeat(32), name: 'example.test', account: { id: state.account } }]
			else if (url.pathname.endsWith('/domains')) {
				if (method === 'POST') attached = true
				result = attached ? [{ name: hostname }] : []
			} else if (url.pathname.endsWith('/dns_records')) {
				if (method === 'POST') {
					dns = [{ ...record }]
					created++
					result = record
				} else result = dns
			} else if (url.pathname.endsWith('/dns_records/record-1') && method === 'DELETE') {
				dns = []
				deleted++
				result = { id: 'record-1' }
			} else throw new Error(`Unexpected fixture request: ${method} ${url.pathname}`)
			return Response.json({ success: true, result })
		}
		try {
			const attach = () =>
				attachDomain(state, hostname, 'fixture-token', async () => {
					saved++
				})
			if (mode === 'conflict') {
				await assert.rejects(attach, /another service/)
				assert.equal(attached, false)
				assert.equal(saved, 0)
				assert.equal(created, 0)
				return
			}
			await attach()
			await attach()
			assert.equal(created, mode === 'reuse' ? 0 : 1)
			assert.equal(state.domain?.dnsRecordId, 'record-1')
			if (mode === 'changed') {
				dns[0].content = 'another-service.example.test'
				await assert.rejects(() => removeDomainDns(state, 'fixture-token'), /changed outside/)
				assert.equal(deleted, 0)
			} else {
				await removeDomainDns(state, 'fixture-token')
				assert.equal(deleted, mode === 'reuse' ? 0 : 1)
				assert.equal(dns.length, mode === 'reuse' ? 1 : 0)
			}
		} finally {
			globalThis.fetch = original
		}
	})
}

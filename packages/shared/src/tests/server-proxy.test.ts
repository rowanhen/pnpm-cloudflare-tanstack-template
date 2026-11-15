import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { fetchApi } from '../server-proxy.ts'

describe('server proxy', () => {
	test('when API calls run in deployment, a service binding is required', async () => {
		const request = new Request('https://dashboard.example.test/api/me')
		await assert.rejects(
			fetchApi(request, '/api/me', {}, { dev: false, localUrl: 'http://localhost:8787' }),
			/Set the API service binding/,
		)
	})

	test('when API calls use the service binding, path and visitor address are forwarded', async () => {
		let forwarded: Request | undefined
		const request = Object.assign(new Request('https://dashboard.example.test/api/me'), {
			runtime: {
				cloudflare: {
					env: {
						API_PROXY_SECRET: 'test-secret',
						API: {
							fetch: async (outbound: Request) => {
								forwarded = outbound
								return Response.json({ ok: true })
							},
						},
					},
				},
			},
		})
		request.headers.set('cf-connecting-ip', '203.0.113.4')
		request.headers.set('x-starter-ip', 'forged')
		const response = await fetchApi(
			request,
			'/api/me?section=profile',
			{},
			{ dev: false, localUrl: 'http://localhost:8787' },
		)
		assert.equal(response.status, 200)
		assert.equal(forwarded?.url, 'https://dashboard.example.test/api/me?section=profile')
		assert.equal(forwarded?.headers.get('x-starter-ip'), '203.0.113.4')
		assert.match(forwarded?.headers.get('x-starter-signature') ?? '', /^[a-f0-9]{64}$/)
	})
})

import { env } from 'cloudflare:workers'
import { SELF } from 'cloudflare:test'
import { describe, expect, test } from 'vitest'

describe('API Workers runtime', () => {
	test('when an unauthenticated request reaches a protected route, Workers return an API error', async () => {
		const response = await SELF.fetch('http://localhost/api/todos')
		expect(response.status).toBe(401)
		expect(await response.json()).toEqual({ code: 'unauthorized', error: 'Sign in to continue' })
	})

	test('when storage bindings run in Workers, D1 and R2 are available', async () => {
		const row = await env.DB.prepare('SELECT 1 AS value').first<{ value: number }>()
		expect(row?.value).toBe(1)
		await env.FILES.put('vitest-binding.txt', 'ready')
		expect(await (await env.FILES.get('vitest-binding.txt'))?.text()).toBe('ready')
	})
})

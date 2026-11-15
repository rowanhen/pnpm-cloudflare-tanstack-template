import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { ApiError, createContractFetch } from '../client.ts'

describe('contract client', () => {
	test('when browser transport handles binary data or HEAD errors, it preserves the response', async () => {
		const bytes = new Uint8Array([0, 1, 128, 255])
		const download = createContractFetch(
			async () =>
				new Response(bytes, {
					headers: { 'Content-Type': 'application/octet-stream', ETag: '"file"' },
				}),
		)
		const result = await download<{ data: Blob; status: number; headers: Headers }>(
			'/api/files/test.bin',
		)
		assert.deepEqual(new Uint8Array(await result.data.arrayBuffer()), bytes)
		assert.equal(result.headers.get('ETag'), '"file"')
		const head = createContractFetch(async () => new Response(null, { status: 404 }))
		await assert.rejects(
			head(
				'/api/files/missing',
				{ method: 'HEAD' },
				{
					errorResponses: [{ status: 404, contentType: '' }],
				},
			),
			(error) => {
				assert.ok(error instanceof ApiError)
				assert.equal(error.status, 404)
				assert.deepEqual(error.response, { data: undefined, status: 404, headers: new Headers() })
				return true
			},
		)
	})
})

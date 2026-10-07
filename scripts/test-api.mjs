import assert from 'node:assert/strict'

export async function waitForApi(base, child) {
	for (let attempt = 0; attempt < 90; attempt++) {
		if (child?.exitCode != null) throw new Error('Worker exited before becoming ready')
		try {
			if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(3000) })).ok) return
		} catch {
			/* Startup / DNS propagation. */
		}
		await new Promise((resolve) => setTimeout(resolve, 1000))
	}
	throw new Error(`API did not become ready: ${base}`)
}

export async function testApi(base, token = '') {
	const headers = token ? { Authorization: `Bearer ${token}` } : {}
	const request = (path, init = {}) =>
		fetch(`${base}${path}`, {
			...init,
			headers: { ...headers, ...init.headers },
			signal: AbortSignal.timeout(15000),
		})
	const body = (value) => ({
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(value),
	})
	let testError
	const keys = ['e2e-file.txt', 'e2e-binary.bin', 'e2e-empty.txt']
	let id
	try {
		assert.equal((await request('/api/health')).status, 200)
		if (token) {
			const unauthorized = await fetch(`${base}/api/todos`, { signal: AbortSignal.timeout(15000) })
			assert.equal(unauthorized.status, 401, `Unauthorized response: ${await unauthorized.text()}`)
			assert.equal(
				(await fetch(`${base}/api/files/e2e-file.txt`, { method: 'PUT', body: 'unauthorized' }))
					.status,
				401,
			)
		}
		let response = await request('/api/todos', {
			method: 'POST',
			...body({ title: '  E2E todo  ' }),
		})
		assert.equal(response.status, 201)
		let item = (await response.json()).todo
		id = item.id
		assert.equal(item.title, 'E2E todo')
		assert.equal(item.completed, false)
		assert.ok(item.created_at)
		assert.equal((await (await request(`/api/todos/${id}`)).json()).todo.id, id)
		assert.ok((await (await request('/api/todos')).json()).todos.some((todo) => todo.id === id))
		response = await request(`/api/todos/${id}`, {
			method: 'PATCH',
			...body({ title: "Updated ' todo", completed: true }),
		})
		assert.equal(response.status, 200)
		item = (await response.json()).todo
		assert.equal(item.completed, true)
		assert.equal(item.title, "Updated ' todo")
		for (const invalid of [
			{ title: '' },
			{ title: ' '.repeat(2) },
			{ title: 'x'.repeat(201) },
			{ title: 1 },
			null,
			[],
		]) {
			assert.equal((await request('/api/todos', { method: 'POST', ...body(invalid) })).status, 400)
		}
		assert.equal(
			(
				await request('/api/todos', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: '{broken',
				})
			).status,
			400,
		)
		assert.equal(
			(await request('/api/todos', { method: 'POST', ...body({ title: 'x'.repeat(17000) }) }))
				.status,
			413,
		)
		assert.equal((await request('/api/todos', { method: 'POST', body: 'text' })).status, 415)
		assert.equal(
			(await request(`/api/todos/${id}`, { method: 'PATCH', ...body({ completed: 1 }) })).status,
			400,
		)
		assert.equal((await request(`/api/todos/${id}`, { method: 'PATCH', ...body({}) })).status, 400)
		assert.equal(
			(await request('/api/todos/missing', { method: 'PATCH', ...body({ completed: true }) }))
				.status,
			404,
		)
		assert.equal((await request('/api/todos', { method: 'PUT' })).status, 405)
		assert.equal((await request(`/api/todos/${id}`, { method: 'DELETE' })).status, 204)
		assert.equal((await request(`/api/todos/${id}`)).status, 404)
		assert.equal((await request(`/api/todos/${id}`, { method: 'DELETE' })).status, 404)
		id = undefined
		console.log('PASS D1: create, list, read, update, delete, validation and missing records')

		response = await request(`/api/files/${keys[0]}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'text/plain' },
			body: 'Hello R2!\n',
		})
		assert.equal(response.status, 201)
		const metadata = (await response.json()).file
		assert.equal(metadata.size, 10)
		response = await request(`/api/files/${keys[0]}`)
		assert.equal(response.headers.get('Content-Type'), 'text/plain')
		assert.equal(response.headers.get('ETag'), metadata.etag)
		assert.match(response.headers.get('Content-Disposition'), /attachment/)
		assert.equal(await response.text(), 'Hello R2!\n')
		response = await request(`/api/files/${keys[0]}`, { method: 'HEAD' })
		assert.equal(response.status, 200)
		assert.equal(response.headers.get('Content-Length'), '10')
		assert.equal(await response.text(), '')
		assert.equal(
			(await request(`/api/files/${keys[0]}`, { method: 'PUT', body: 'replaced' })).status,
			201,
		)
		assert.equal(await (await request(`/api/files/${keys[0]}`)).text(), 'replaced')
		const binary = new Uint8Array([0, 1, 127, 128, 255])
		assert.equal(
			(await request(`/api/files/${keys[1]}`, { method: 'PUT', body: binary })).status,
			201,
		)
		assert.deepEqual(
			new Uint8Array(await (await request(`/api/files/${keys[1]}`)).arrayBuffer()),
			binary,
		)
		assert.equal((await request(`/api/files/${keys[2]}`, { method: 'PUT', body: '' })).status, 201)
		let page = await (await request('/api/files?limit=1')).json()
		const listed = [...page.files]
		while (page.cursor) {
			page = await (
				await request(`/api/files?limit=1&cursor=${encodeURIComponent(page.cursor)}`)
			).json()
			listed.push(...page.files)
		}
		for (const key of keys) assert.ok(listed.some((file) => file.key === key))
		assert.equal((await request('/api/files?limit=-1')).status, 400)
		assert.equal(
			(await request('/api/files/bad%2Fkey', { method: 'PUT', body: 'bad' })).status,
			400,
		)
		assert.equal(
			(
				await request(`/api/files/${keys[0]}`, {
					method: 'PUT',
					body: new Uint8Array(5 * 1024 * 1024 + 1),
				})
			).status,
			413,
		)
		for (const key of keys) {
			assert.equal((await request(`/api/files/${key}`, { method: 'DELETE' })).status, 204)
			assert.equal((await request(`/api/files/${key}`)).status, 404)
		}
		console.log(
			'PASS R2: upload, metadata, download, HEAD, overwrite, binary, empty files, pagination, size limit and delete',
		)
		response = await request('/api/todos', {
			method: 'OPTIONS',
			headers: {
				Origin: 'http://localhost:3001',
				'Access-Control-Request-Method': 'POST',
				'Access-Control-Request-Headers': 'Content-Type, Authorization',
			},
		})
		assert.equal(response.status, 204)
		assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3001')
		response = await request('/api/todos', { headers: { Origin: 'https://untrusted.example' } })
		assert.equal(response.status, 403)
		assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
		assert.equal((await request('/api/not-found')).status, 404)
		console.log('PASS HTTP: CORS, preflight, unknown routes and authentication where enabled')
	} catch (error) {
		testError = error
		console.error('API assertion failed:', error)
	}
	{
		const cleanup = await Promise.allSettled([
			...keys.map((key) =>
				request(`/api/files/${key}`, { method: 'DELETE' }).then((response) =>
					assert.equal(response.status, 204),
				),
			),
			...(id
				? [
						request(`/api/todos/${id}`, { method: 'DELETE' }).then((response) =>
							assert.ok([204, 404].includes(response.status)),
						),
					]
				: []),
		])
		const failures = cleanup.filter((result) => result.status === 'rejected')
		if (failures.length)
			throw new AggregateError(
				[...(testError ? [testError] : []), ...failures.map((result) => result.reason)],
				'API test or data cleanup failed',
			)
		if (testError) throw testError
	}
}

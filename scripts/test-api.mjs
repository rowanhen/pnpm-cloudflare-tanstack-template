import { createHmac } from 'node:crypto'
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

export async function testApi(base, cookies, proxySecret, authOrigin = 'http://localhost:3001') {
	const request = (path, init = {}, user = 0) =>
		fetch(`${base}${path}`, {
			...init,
			headers: { Cookie: cookies[user], Origin: 'http://localhost:3001', ...init.headers },
			signal: AbortSignal.timeout(15000),
		})
	const body = (value) => ({
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(value),
	})
	const unauth = (path, init = {}) =>
		fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(15000) })
	let todoId, keyId
	const files = ['e2e-file.txt', 'e2e-binary.bin', 'e2e-empty.txt']
	try {
		assert.equal((await unauth('/api/todos')).status, 401)
		assert.equal((await unauth('/api/keys')).status, 401)
		assert.equal((await unauth('/api/files')).status, 401)
		const me = await request('/api/me')
		assert.equal(me.status, 200, await me.clone().text())
		assert.equal((await me.json()).user.email, 'alice@example.test')
		assert.equal(
			(await unauth('/api/me', { headers: { Cookie: cookies[0] + 'tampered' } })).status,
			401,
		)
		assert.equal((await unauth('/api/me', { headers: { Cookie: cookies[2] } })).status, 401)
		const invalidCallback = await unauth('/api/auth/callback/google?code=invalid&state=invalid', {
			redirect: 'manual',
		})
		assert.equal(invalidCallback.status, 302)
		assert.match(invalidCallback.headers.get('location'), /error=/)
		const oauth = await request('/api/auth/sign-in/social', {
			method: 'POST',
			...body({ provider: 'google', callbackURL: 'http://localhost:3001/' }),
		})
		assert.equal(oauth.status, 200, await oauth.clone().text())
		const authUrl = new URL((await oauth.json()).url)
		assert.equal(authUrl.origin, 'https://accounts.google.com')
		assert.equal(authUrl.searchParams.get('redirect_uri'), `${authOrigin}/api/auth/callback/google`)
		assert.ok(authUrl.searchParams.get('state'))
		assert.ok(authUrl.searchParams.get('code_challenge'))
		assert.equal(
			(
				await request('/api/auth/sign-in/social', {
					method: 'POST',
					...body({ provider: 'google', callbackURL: 'https://evil.example/' }),
				})
			).status,
			403,
		)
		assert.equal(
			(
				await request('/api/auth/sign-up/email', {
					method: 'POST',
					...body({ name: 'Attacker', email: 'attacker@example.test', password: 'NotAllowed123!' }),
				})
			).status,
			400,
		)
		console.log(
			'PASS auth: signed sessions, expiry, tampering, invalid callback, Google OAuth/PKCE initiation, redirect validation, password signup disabled',
		)
		let response = await request('/api/todos', {
			method: 'POST',
			...body({ title: 'Private todo' }),
		})
		assert.equal(response.status, 201, await response.clone().text())
		todoId = (await response.json()).todo.id
		assert.equal((await request(`/api/todos/${todoId}`, {}, 1)).status, 404)
		assert.equal(
			(await request(`/api/todos/${todoId}`, { method: 'PATCH', ...body({ completed: true }) }, 1))
				.status,
			404,
		)
		assert.equal((await request(`/api/todos/${todoId}`, { method: 'DELETE' }, 1)).status, 404)
		assert.equal((await (await request('/api/todos', {}, 1)).json()).todos.length, 0)
		response = await request(`/api/todos/${todoId}`, {
			method: 'PATCH',
			...body({ completed: true, title: "Updated ' todo" }),
		})
		assert.equal((await response.json()).todo.completed, true)
		for (const invalid of [{ title: '' }, { title: 'x'.repeat(201) }, { title: 1 }, null, []])
			assert.equal((await request('/api/todos', { method: 'POST', ...body(invalid) })).status, 400)
		assert.equal(
			(await request('/api/todos', { method: 'POST', ...body({ title: 'x'.repeat(17000) }) }))
				.status,
			413,
		)
		assert.equal(
			(
				await unauth('/api/todos', {
					method: 'POST',
					...body({ title: 'csrf' }),
					headers: { Cookie: cookies[0], 'Content-Type': 'application/json' },
				})
			).status,
			403,
		)
		console.log('PASS D1: CRUD, validation, CSRF, cross-user isolation')
		response = await request('/api/keys', { method: 'POST', ...body({ name: 'Test key' }) })
		assert.equal(response.status, 201)
		const key = (await response.json()).key
		keyId = key.id
		assert.match(key.token, /^idea_[a-f0-9]{64}$/)
		assert.equal(key.scope, 'todos:read')
		const keyList = await (await request('/api/keys')).json()
		assert.equal(keyList.keys[0].token, undefined)
		assert.equal(keyList.keys[0].key_hash, undefined)
		assert.equal((await (await request('/api/keys', {}, 1)).json()).keys.length, 0)
		assert.equal((await request(`/api/keys/${key.id}`, { method: 'DELETE' }, 1)).status, 404)
		// Keep the concurrent burst within one fixed-minute window.
		const remaining = 60000 - (Date.now() % 60000)
		if (remaining < 30000) await new Promise((resolve) => setTimeout(resolve, remaining + 100))
		const auth = { Authorization: `Bearer ${key.token}` }
		response = await unauth('/api/v1/todos', { headers: auth })
		assert.equal(response.status, 200)
		assert.equal(response.headers.get('X-RateLimit-Remaining'), '29')
		assert.equal((await response.json()).todos[0].id, todoId)
		assert.equal((await unauth('/api/todos', { headers: auth })).status, 401)
		assert.equal((await unauth('/api/keys', { headers: auth })).status, 401)
		assert.equal((await unauth('/api/v1/todos', { method: 'POST', headers: auth })).status, 405)
		const burst = await Promise.all(
			Array.from({ length: 35 }, () => unauth('/api/v1/todos', { headers: auth })),
		)
		assert.equal(burst.filter((result) => result.status === 200).length, 29)
		const limited = burst.filter((result) => result.status === 429)
		assert.equal(limited.length, 6)
		assert.ok(Number(limited[0].headers.get('Retry-After')) > 0)
		assert.equal((await request(`/api/keys/${key.id}`, { method: 'DELETE' })).status, 204)
		assert.equal((await unauth('/api/v1/todos', { headers: auth })).status, 401)
		keyId = undefined
		console.log(
			'PASS API keys: one-time reveal, scope, owner isolation, atomic concurrent rate limiting, immediate revocation',
		)
		for (const [index, content] of [
			'Hello R2!\n',
			new Uint8Array([0, 1, 128, 255]),
			'',
		].entries()) {
			response = await request(`/api/files/${files[index]}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/octet-stream' },
				body: content,
			})
			assert.equal(response.status, 201)
			response = await request(`/api/files/${files[index]}`)
			assert.equal(response.status, 200)
			assert.deepEqual(
				new Uint8Array(await response.arrayBuffer()),
				typeof content === 'string' ? new TextEncoder().encode(content) : content,
			)
			assert.equal((await request(`/api/files/${files[index]}`, {}, 1)).status, 404)
		}
		assert.equal((await (await request('/api/files', {}, 1)).json()).files.length, 0)
		// Deleting the same filename from Bob's namespace cannot delete Alice's object.
		await request(`/api/files/${files[0]}`, { method: 'DELETE' }, 1)
		assert.equal((await request(`/api/files/${files[0]}`)).status, 200)
		let page = await (await request('/api/files?limit=1')).json()
		let count = page.files.length
		while (page.cursor) {
			page = await (
				await request(`/api/files?limit=1&cursor=${encodeURIComponent(page.cursor)}`)
			).json()
			count += page.files.length
		}
		assert.equal(count, 3)
		assert.equal(
			(
				await request(`/api/files/${files[0]}`, {
					method: 'PUT',
					body: new Uint8Array(5 * 1024 * 1024 + 1),
				})
			).status,
			413,
		)
		assert.equal(
			(await request('/api/files/bad%2Fkey', { method: 'PUT', body: 'bad' })).status,
			400,
		)
		console.log(
			'PASS R2: text/binary/empty uploads, downloads, pagination, limits and user isolation',
		)
		const signup = { email: 'alice@example.test', name: 'Alice', consent: true }
		const first = await unauth('/api/waitlist', { method: 'POST', ...body(signup) })
		const duplicate = await unauth('/api/waitlist', { method: 'POST', ...body(signup) })
		assert.equal(first.status, 202)
		assert.equal(await first.text(), await duplicate.text())
		assert.equal((await (await request('/api/waitlist/me')).json()).joined, true)
		assert.equal(
			(await unauth('/api/waitlist', { method: 'POST', ...body({ ...signup, consent: false }) }))
				.status,
			400,
		)
		assert.equal(
			(
				await unauth('/api/waitlist', {
					method: 'POST',
					...body({ ...signup, email: 'not-email' }),
				})
			).status,
			400,
		)
		assert.equal((await unauth('/api/waitlist')).status, 401)
		assert.equal(
			(await request('/api/todos', { headers: { Origin: 'https://evil.example' } })).status,
			403,
		)
		console.log('PASS waitlist: signup, idempotence, consent, validation, no public email listing')
		const forwarded = (ip, age = 0) => {
			const timestamp = String(Math.floor(Date.now() / 1000) - age)
			return {
				'x-starter-ip': ip,
				'x-starter-time': timestamp,
				'x-starter-signature': createHmac('sha256', proxySecret)
					.update(`${timestamp}\n${ip}`)
					.digest('hex'),
			}
		}
		assert.equal(
			(
				await unauth('/api/health', {
					headers: { ...forwarded('192.0.2.1'), 'x-starter-signature': '0'.repeat(64) },
				})
			).status,
			403,
		)
		assert.equal(
			(await unauth('/api/health', { headers: forwarded('192.0.2.1', 120) })).status,
			403,
		)
		for (let index = 0; index < 11; index++) {
			const signupBody = body({ email: `proxy-${index}@example.test`, consent: true })
			const result = await unauth('/api/waitlist', {
				method: 'POST',
				...signupBody,
				headers: { ...signupBody.headers, ...forwarded('192.0.2.1') },
			})
			assert.equal(result.status, index < 10 ? 202 : 429, await result.text())
		}
		const otherSignup = body({ email: 'proxy-another-ip@example.test', consent: true })
		assert.equal(
			(
				await unauth('/api/waitlist', {
					method: 'POST',
					...otherSignup,
					headers: { ...otherSignup.headers, ...forwarded('192.0.2.2') },
				})
			).status,
			202,
		)
		console.log(
			'PASS proxy: signed visitor IPs, forged/expired signature rejection, separate visitor rate limits',
		)
	} finally {
		for (const key of files) await request(`/api/files/${key}`, { method: 'DELETE' })
		if (todoId) await request(`/api/todos/${todoId}`, { method: 'DELETE' })
		if (keyId) await request(`/api/keys/${keyId}`, { method: 'DELETE' })
	}
}

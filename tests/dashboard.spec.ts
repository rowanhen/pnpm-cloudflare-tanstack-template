import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const dashboardUrl = process.env.E2E_DASHBOARD_URL ?? 'http://localhost:3001'
const marketingUrl = process.env.E2E_MARKETING_URL ?? 'http://localhost:3000'
const canonicalUrl = process.env.E2E_MARKETING_URL ?? 'https://starter.example'
const cloudRun = Boolean(process.env.E2E_DASHBOARD_URL)
const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:8787'
const alice = process.env.E2E_COOKIE_ALICE ?? ''
const bob = process.env.E2E_COOKIE_BOB ?? ''
function cookie(value: string) {
	const separator = value.indexOf('=')
	return {
		name: value.slice(0, separator),
		value: value.slice(separator + 1),
		url: dashboardUrl,
		secure: dashboardUrl.startsWith('https:'),
		httpOnly: true,
		sameSite: 'Lax' as const,
	}
}

test('signed-out requests are redirected on the server and Google starts OAuth', async ({
	page,
	request,
}) => {
	const response = await request.get(`${dashboardUrl}/`, { maxRedirects: 0 })
	expect([302, 307]).toContain(response.status())
	expect(response.headers().location).toBe('/login')
	await page.goto('/')
	await expect(page).toHaveURL(/\/login$/)
	await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
	await expect(page.getByRole('heading', { name: 'D1 todos' })).toHaveCount(0)
	await page.route('https://accounts.google.com/**', (route) =>
		route.fulfill({ status: 200, body: 'Google OAuth handoff' }),
	)
	await page.getByRole('button', { name: 'Continue with Google' }).click()
	await expect(page).toHaveURL(/^https:\/\/accounts.google.com\//)
	const url = new URL(page.url())
	expect(url.searchParams.get('redirect_uri')).toBe(`${dashboardUrl}/api/auth/callback/google`)
	expect(url.searchParams.get('state')).toBeTruthy()
	expect(url.searchParams.get('code_challenge')).toBeTruthy()
})

test('signed-in dashboard persists private D1/R2 data and manages scoped API keys', async ({
	page,
	context,
	request,
}) => {
	await context.addCookies([cookie(alice)])
	const title = `Browser todo ${Date.now()}`
	const filename = 'e2e-browser.txt'
	const contents = 'Browser to authenticated Worker to R2 and back.\n'
	const headers = { Cookie: alice, Origin: dashboardUrl }
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	try {
		const initial = await page.goto('/')
		expect(initial?.headers()['cache-control']).toContain('no-store')
		await expect(page.getByText('alice@example.test', { exact: true })).toBeVisible()
		await page.getByLabel('Todo title', { exact: true }).fill(title)
		await page.getByRole('button', { name: 'Add todo', exact: true }).click()
		const checkbox = page.getByRole('checkbox', { name: title, exact: true })
		await expect(checkbox).toBeVisible()
		await checkbox.click()
		await expect(checkbox).toBeChecked()
		await page.reload()
		await expect(checkbox).toBeChecked()
		await page
			.getByLabel('File', { exact: true })
			.setInputFiles({ name: filename, mimeType: 'text/plain', buffer: Buffer.from(contents) })
		await page.getByRole('button', { name: 'Upload file', exact: true }).click()
		const downloadButton = page.getByRole('button', { name: `Download ${filename}`, exact: true })
		await expect(downloadButton).toBeVisible()
		const downloadPromise = page.waitForEvent('download')
		await downloadButton.click()
		const download = await downloadPromise
		const path = await download.path()
		if (!path) throw new Error('Download path missing')
		expect(await readFile(path, 'utf8')).toBe(contents)
		await page.getByLabel('Key name', { exact: true }).fill('Browser key')
		await page.getByRole('button', { name: 'Create API key' }).click()
		const tokenField = page.getByLabel('New API key', { exact: true })
		await expect(tokenField).toBeVisible()
		const token = await tokenField.inputValue()
		const result = await request.get(`${apiUrl}/api/v1/todos`, {
			headers: { Authorization: `Bearer ${token}` },
		})
		expect(result.status()).toBe(200)
		expect(
			(await result.json()).todos.some((item: { title: string }) => item.title === title),
		).toBe(true)
		await page.reload()
		await expect(tokenField).toHaveCount(0)
		await page.getByRole('button', { name: 'Delete API key Browser key' }).click()
		await expect(page.getByRole('button', { name: 'Delete API key Browser key' })).toHaveCount(0)
		expect(
			(
				await request.get(`${apiUrl}/api/v1/todos`, {
					headers: { Authorization: `Bearer ${token}` },
				})
			).status(),
		).toBe(401)
		const other = await request.get(`${apiUrl}/api/todos`, { headers: { Cookie: bob } })
		expect((await other.json()).todos.some((item: { title: string }) => item.title === title)).toBe(
			false,
		)
		await page.getByRole('button', { name: `Delete file ${filename}`, exact: true }).click()
		await expect(downloadButton).toHaveCount(0)
		await page.getByRole('button', { name: `Delete todo ${title}`, exact: true }).click()
		await expect(checkbox).toHaveCount(0)
		await expect(page.getByRole('alert')).toHaveCount(0)
		expect(errors).toEqual([])
	} finally {
		await request.delete(`${apiUrl}/api/files/${filename}`, { headers })
		const { todos } = await (await request.get(`${apiUrl}/api/todos`, { headers })).json()
		for (const todo of todos)
			if (todo.title === title) await request.delete(`${apiUrl}/api/todos/${todo.id}`, { headers })
		const { keys } = await (await request.get(`${apiUrl}/api/keys`, { headers })).json()
		for (const key of keys)
			if (key.name === 'Browser key')
				await request.delete(`${apiUrl}/api/keys/${key.id}`, { headers })
	}
})

test('waitlist signup persists and SEO is present in server-rendered HTML', async ({
	page,
	request,
}) => {
	const html = await (await request.get(marketingUrl)).text()
	expect(html).toContain(`rel="canonical" href="${canonicalUrl}/"`)
	expect(html).toContain('property="og:image"')
	expect(html).toContain('name="twitter:card"')
	expect(html).toContain('application/ld+json')
	await page.goto(marketingUrl)
	await expect(page.locator('h1')).toHaveCount(1)
	await page.getByLabel('Email address', { exact: true }).fill('bob@example.test')
	await page.getByRole('checkbox').check()
	await page.getByRole('button', { name: 'Join the waitlist' }).click()
	await expect(page.getByRole('status')).toContainText("You're on the list")
	const joined = await request.get(`${apiUrl}/api/waitlist/me`, { headers: { Cookie: bob } })
	expect((await joined.json()).joined).toBe(true)
	expect(await (await request.get(`${marketingUrl}/robots.txt`)).text()).toContain(
		cloudRun ? 'Disallow: /' : `Sitemap: ${canonicalUrl}/sitemap.xml`,
	)
	const sitemap = await (await request.get(`${marketingUrl}/sitemap.xml`)).text()
	expect(sitemap).toContain(`<loc>${canonicalUrl}/</loc>`)
	expect(sitemap).toContain(`<loc>${canonicalUrl}/privacy</loc>`)
	const image = await request.get(`${marketingUrl}/og.png`)
	expect(image.headers()['content-type']).toContain('image/png')
	expect((await request.get(`${marketingUrl}/privacy`)).status()).toBe(200)
})

test('sign-out invalidates the server session and protects subsequent navigation', async ({
	page,
	context,
	request,
}) => {
	await context.addCookies([cookie(alice)])
	await page.goto('/')
	await page.getByRole('button', { name: 'Sign out', exact: true }).click()
	await expect(page).toHaveURL(/\/login$/)
	expect((await request.get(`${apiUrl}/api/me`, { headers: { Cookie: alice } })).status()).toBe(401)
	await page.goto('/')
	await expect(page).toHaveURL(/\/login$/)
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
})

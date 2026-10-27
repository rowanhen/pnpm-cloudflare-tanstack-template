import { test, expect } from '@playwright/test'
const marketing = process.env.E2E_MARKETING_URL ?? 'http://localhost:3000'

test('starter landing offers copyable setup and links to the examples', async ({
	page,
	context,
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: marketing })
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await page.goto(marketing)
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('CloudflareStarter')
	await expect(page.getByRole('link', { name: 'Use the template' })).toHaveAttribute(
		'href',
		/\/generate$/,
	)
	await page.getByRole('button', { name: 'Copy run command', exact: true }).click()
	await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('pnpm dev')
	await page.getByRole('link', { name: 'Explore the examples' }).click()
	await expect(page).toHaveURL(/#examples$/)
	await expect(
		page.getByRole('navigation', { name: 'Examples' }).getByRole('link', { name: /Dashboard/ }),
	).toHaveAttribute('href', process.env.E2E_DASHBOARD_URL ?? 'http://localhost:3001')
	await page.screenshot({
		path: 'test-results/marketing-desktop.png',
		fullPage: true,
		animations: 'disabled',
	})
	await page.setViewportSize({ width: 390, height: 844 })
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
	await page.screenshot({
		path: 'test-results/marketing-mobile.png',
		fullPage: true,
		animations: 'disabled',
	})
	expect(errors).toEqual([])
})

test('route content publishes HTML, Markdown and discovery documents', async ({
	page,
	request,
}) => {
	for (const path of ['/', '/privacy', '/guides/getting-started']) {
		const response = await page.goto(`${marketing}${path}`)
		expect(response?.status()).toBe(200)
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			`https://starter.example${path}`,
		)
		const markdownPath = path === '/' ? '/index.md' : `${path}.md`
		await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
			'href',
			markdownPath,
		)
		const markdown = await request.get(`${marketing}${markdownPath}`)
		expect(markdown.status()).toBe(200)
		expect(markdown.headers()['content-type']).toContain('text/markdown')
		expect(await markdown.text()).toContain('# ')
		expect(await markdown.text()).not.toContain('<!DOCTYPE')
	}
	const llms = await request.get(`${marketing}/llms.txt`)
	expect(await llms.text()).toContain('https://starter.example/guides/getting-started.md')
	const sitemap = await request.get(`${marketing}/sitemap.xml`)
	expect(await sitemap.text()).toContain(
		'<loc>https://starter.example/guides/getting-started</loc>',
	)
	expect(await sitemap.text()).not.toContain('/waitlist/success')
	for (const path of ['/missing', '/missing.md', '/api/waitlist.md']) {
		expect((await request.get(`${marketing}${path}`)).status()).toBe(404)
	}
})

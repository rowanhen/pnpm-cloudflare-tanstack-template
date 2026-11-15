import { test, expect } from '@playwright/test'
test.describe('marketing pages', () => {
	test('when pages are requested, home exposes Markdown and guide and privacy serve HTML', async ({
		page,
		request,
	}) => {
		expect((await request.get('http://localhost:3100/', { maxRedirects: 0 })).status()).toBe(308)
		await page.goto('http://localhost:3100')
		await expect(page).toHaveURL('http://localhost:3100/en')
		await expect(page).toHaveTitle('Cloudflare Starter — By Leitware')
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			'http://localhost:3100/en',
		)
		await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
			'href',
			'/en/index.md',
		)
		for (const content of ['Clone', 'Google sign-in', 'Try the waitlist'])
			await expect(page.getByText(content, { exact: true })).toBeVisible()
		const homeMarkdown = await request.get('http://localhost:3100/en/index.md')
		expect(homeMarkdown.status()).toBe(200)
		expect(homeMarkdown.headers()['content-type']).toContain('text/markdown')
		expect(await homeMarkdown.text()).toContain('### Google sign-in')
		await page.getByRole('link', { name: 'Setup', exact: true }).click()
		await expect(page).toHaveURL(/#setup$/)
		await page.goto('http://localhost:3100/en/guides/getting-started')
		await expect(page.getByText('Use the template to create your repository.')).toBeVisible()
		await expect(page.getByText('Setup & deployment')).toBeVisible()
		await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveCount(0)
		expect((await request.get('http://localhost:3100/en/guides/getting-started.md')).status()).toBe(
			404,
		)
		await page.getByRole('link', { name: 'Privacy', exact: true }).click()
		await expect(page.getByRole('heading', { name: 'Privacy in this demo' })).toBeVisible()
		await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveCount(0)
		expect((await request.get('http://localhost:3100/en/privacy.md')).status()).toBe(404)
		const llms = await request.get('http://localhost:3100/llms.txt')
		expect(await llms.text()).toContain('http://localhost:3100/en/index.md')
		expect(await llms.text()).toContain('http://localhost:3100/en/guides/getting-started')
		expect(await llms.text()).not.toContain('/en/guides/getting-started.md')
		expect((await request.get('http://localhost:3100/fr/index.md')).status()).toBe(404)
		expect((await request.get('http://localhost:3100/fr')).status()).toBe(404)
	})

	test('when the waitlist form is submitted, the page navigates to success', async ({ page }) => {
		await page.goto('http://localhost:3100')
		await expect(page).toHaveURL('http://localhost:3100/en')
		await page.getByLabel('Email address', { exact: true }).fill(`smoke-${Date.now()}@example.test`)
		await page.getByRole('checkbox', { name: 'Save my email in this demo.' }).check()
		await page.getByRole('button', { name: 'Join the waitlist' }).click()
		await expect(page.getByRole('heading', { name: "You're on the list." })).toBeVisible()
		await expect(page.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/en')
	})

	test('when routes are missing or fail, the matching error page appears', async ({
		page,
		request,
	}) => {
		const missing = await request.get('http://localhost:3100/en/not-a-page')
		expect(missing.status()).toBe(404)
		await page.goto('http://localhost:3100/en/not-a-page')
		await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
		await expect(page.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/en')

		await page.goto('http://localhost:3100/404')
		await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
		await page.goto('http://localhost:3100/error')
		await expect(page.getByRole('heading', { name: "Couldn't load this page" })).toBeVisible()
	})
})

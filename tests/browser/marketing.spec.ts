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
	const container = page.locator('[data-slot="container"]').first()
	await expect.poll(async () => (await container.boundingBox())?.width).toBe(768)
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('CloudflareStarter')
	const setupLink = page
		.getByRole('navigation', { name: 'Main navigation' })
		.getByRole('link', { name: 'Setup', exact: true })
	await expect(setupLink).toBeVisible()
	const featureTitle = await page
		.getByRole('heading', { name: 'Google sign-in', exact: true })
		.boundingBox()
	const featureDescription = await page
		.getByText('Sessions and a protected dashboard.', { exact: true })
		.boundingBox()
	expect(featureTitle).not.toBeNull()
	expect(featureDescription).not.toBeNull()
	expect(featureDescription?.x).toBeGreaterThan(featureTitle?.x ?? 0)
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
	await page.setViewportSize({ width: 375, height: 812 })
	await expect(setupLink).toBeHidden()
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
	await page.screenshot({
		path: 'test-results/marketing-mobile.png',
		fullPage: true,
		animations: 'disabled',
	})
	expect(errors).toEqual([])
})

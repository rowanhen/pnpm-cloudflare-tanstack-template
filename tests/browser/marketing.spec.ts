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
	expect(errors).toEqual([])
})

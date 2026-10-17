import { test, expect } from '@playwright/test'

const dashboardUrl = process.env.E2E_DASHBOARD_URL ?? 'http://localhost:3001'
const cookie = process.env.E2E_COOKIE_BOB ?? ''
test('email settings reflect configuration and a signed-in user can send a test', async ({
	page,
	context,
	request,
}) => {
	const split = cookie.indexOf('=')
	await context.addCookies([
		{
			name: cookie.slice(0, split),
			value: cookie.slice(split + 1),
			url: dashboardUrl,
			secure: dashboardUrl.startsWith('https:'),
			httpOnly: true,
			sameSite: 'Lax',
		},
	])
	const config = await (await request.get(`${dashboardUrl}/api/config`)).json()
	await page.goto('/')
	const button = page.getByRole('button', { name: 'Send me a test' })
	if (!config.emailEnabled) {
		await expect(button).toBeDisabled()
		await expect(page.getByText('Email is not connected.')).toBeVisible()
		return
	}
	await expect(button).toBeEnabled()
	await button.click()
	await expect(
		page.getByRole('status').filter({ hasText: 'Email accepted for delivery.' }),
	).toBeVisible()
	await page.reload()
	await expect(page.getByText('accepted', { exact: true })).toBeVisible()
	await page.setViewportSize({ width: 390, height: 844 })
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
	await page.screenshot({
		path: 'test-results/email-mobile.png',
		fullPage: true,
		animations: 'disabled',
	})
})

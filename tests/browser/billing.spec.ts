import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const dashboardUrl = process.env.E2E_DASHBOARD_URL ?? 'http://localhost:3001'
const bob = process.env.E2E_COOKIE_BOB ?? ''

test('a paid key spends a credit, retries for free and can be revoked from the dashboard', async ({
	page,
	context,
	request,
}) => {
	const separator = bob.indexOf('=')
	await context.addCookies([
		{
			name: bob.slice(0, separator),
			value: bob.slice(separator + 1),
			url: dashboardUrl,
			secure: dashboardUrl.startsWith('https:'),
			httpOnly: true,
			sameSite: 'Lax',
		},
	])
	const billing = await request.get(`${dashboardUrl}/api/billing`, { headers: { Cookie: bob } })
	const before = (await billing.json()).balance
	expect(before).toBeGreaterThan(0)
	await page.goto('/')
	await expect(page.getByTestId('credit-balance')).toHaveText(
		new RegExp(`^${before.toLocaleString('en-GB')} credits?$`),
	)
	await expect(page.getByRole('link', { name: 'Add credits', exact: true })).toHaveAttribute(
		'href',
		'/checkout',
	)
	await page.getByLabel('Key name').fill('Paid browser key')
	await page.getByLabel('Access', { exact: true }).selectOption('summary:read')
	await page.getByRole('button', { name: 'Create API key' }).click()
	const token = page.getByLabel('New API key')
	await expect(token).toBeVisible()
	const authorization = `Bearer ${await token.inputValue()}`
	const id = randomUUID()
	const run = () =>
		request.post(`${dashboardUrl}/api/v1/summary`, {
			headers: { Authorization: authorization, 'Idempotency-Key': id },
			data: {},
		})
	const first = await run()
	expect(first.status()).toBe(200)
	expect(first.headers()['x-credits-charged']).toBe('1')
	const retry = await run()
	expect(retry.status()).toBe(200)
	expect(retry.headers()['x-credits-charged']).toBe('0')
	expect(await retry.json()).toEqual(await first.json())
	await page.getByRole('button', { name: 'Refresh balance' }).click()
	await expect(page.getByTestId('credit-balance')).toHaveText(
		new RegExp(`^${(before - 1).toLocaleString('en-GB')} credits?$`),
	)
	await page.setViewportSize({ width: 390, height: 844 })
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true,
	)
	await page.screenshot({
		path: 'test-results/billing-mobile.png',
		fullPage: true,
		animations: 'disabled',
	})
	await page.getByRole('button', { name: 'Delete API key Paid browser key' }).click()
	await expect(page.getByRole('button', { name: 'Delete API key Paid browser key' })).toHaveCount(0)
	expect((await run()).status()).toBe(401)
})

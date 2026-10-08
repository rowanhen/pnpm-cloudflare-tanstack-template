import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
const dashboardUrl = process.env.E2E_DASHBOARD_URL ?? 'http://localhost:3001'
const marketingUrl = process.env.E2E_MARKETING_URL ?? 'http://localhost:3000'
const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:8787'
const provider = process.env.E2E_STRIPE_FIXTURE
const bob = process.env.E2E_COOKIE_BOB ?? ''
const headers = { Cookie: bob, Origin: dashboardUrl }
function cookie() {
	const i = bob.indexOf('=')
	return {
		name: bob.slice(0, i),
		value: bob.slice(i + 1),
		url: dashboardUrl,
		secure: dashboardUrl.startsWith('https:'),
		httpOnly: true,
		sameSite: 'Lax' as const,
	}
}

// Each dev app has its own HMR lifecycle. Use a fresh page per origin so a
// first-load dependency reload cannot interrupt navigation to the other app.
for (const [app, base] of [
	['marketing', marketingUrl],
	['dashboard', dashboardUrl],
]) {
	test(`${app} custom 404 returns 404 and recovery page renders`, async ({ page }) => {
		const response = await page.goto(`${base}/this-page-does-not-exist`)
		expect(response?.status()).toBe(404)
		await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
		await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible()
		await expect(page.locator('[data-slot="card"]')).toBeVisible()
		await page.goto(`${base}/error`)
		await expect(page.getByRole('heading', { name: "Couldn't load this page" })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
		expect(await page.locator('body').innerText()).not.toContain('stack trace')
	})
}

test('checkout is protected and handles unavailable payment configuration', async ({
	page,
	context,
}) => {
	await page.goto('/checkout')
	await expect(page).toHaveURL(/\/login\?next=checkout$/)
	await context.addCookies([cookie()])
	await page.route('**/api/checkout/config', (route) =>
		route.fulfill({ status: 503, json: { error: 'Unconfigured' } }),
	)
	await page.goto('/checkout')
	await expect(page.getByText('Checkout is unavailable.')).toBeVisible()
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Continue to payment' })).toHaveCount(0)
})

test('checkout confirms only a backend-verified order and isolates accounts', async ({
	page,
	context,
	request,
}) => {
	test.skip(!provider, 'Stripe contract fixture is local; live Stripe has a separate manual test')
	await context.addCookies([cookie()])
	await page.goto('/checkout')
	await expect(page.getByRole('heading', { name: 'Starter pass' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled()
	await page.screenshot({
		path: 'test-results/checkout-desktop.png',
		fullPage: true,
		animations: 'disabled',
	})
	await page.setViewportSize({ width: 390, height: 844 })
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true,
	)
	await page.screenshot({
		path: 'test-results/checkout-mobile.png',
		fullPage: true,
		animations: 'disabled',
	})
	const result = await request.post(`${apiUrl}/api/checkout/sessions`, {
		headers,
		data: { requestId: randomUUID() },
	})
	expect(result.status()).toBe(201)
	const { sessionId } = await result.json()
	await page.goto(`/checkout/success?session_id=${sessionId}&paid=true`)
	await expect(page.getByRole('heading', { name: 'Your checkout is incomplete.' })).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Payment successful.' })).toHaveCount(0)
	await request.post(`${provider}/__test/${sessionId}`, {
		data: { status: 'complete', payment_status: 'paid' },
	})
	await page.getByRole('button', { name: 'Check payment status' }).click()
	await expect(page.getByRole('heading', { name: 'Payment successful.' })).toBeVisible()
	await expect(page.getByText(/Test payment of £12.00 confirmed/)).toBeVisible()
	await page.reload()
	await expect(page.getByRole('heading', { name: 'Payment successful.' })).toBeVisible()
	await page.screenshot({
		path: 'test-results/checkout-success.png',
		fullPage: true,
		animations: 'disabled',
	})
	const alice = process.env.E2E_COOKIE_ALICE ?? ''
	const other = await request.get(`${apiUrl}/api/checkout/sessions/${sessionId}`, {
		headers: { Cookie: alice },
	})
	expect(other.status()).toBe(404)
	await page.goto('/checkout/success?session_id=cs_test_nonexistent')
	await expect(page.getByRole('heading', { name: "We couldn't find that order." })).toBeVisible()
	await page.goto('/checkout/success')
	await expect(page.getByRole('heading', { name: "We couldn't find that order." })).toBeVisible()
})

test('marketing and status pages fit a phone viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	for (const path of ['/', '/waitlist/success', '/error', '/missing-page']) {
		await page.goto(`${marketingUrl}${path}`)
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
		).toBe(true)
		await expect(page.locator('h1')).toHaveCount(1)
	}
	await page.goto(marketingUrl)
	await expect(page.getByRole('button', { name: 'Join the waitlist' })).toBeEnabled()
	await page.screenshot({
		path: 'test-results/marketing-mobile.png',
		fullPage: true,
		animations: 'disabled',
	})
})

test('a real server failure uses the custom error boundary and can recover', async ({
	page,
	context,
}) => {
	test.skip(!provider, 'Fault injection is only in the temporary test Worker')
	await context.setExtraHTTPHeaders({ 'x-test-session-failure': 'true' })
	const failed = await page.goto('/login')
	expect(failed?.status()).toBe(500)
	await expect(page.getByRole('heading', { name: "Couldn't load this page" })).toBeVisible()
	await expect(page.locator('[data-slot="card"]')).toBeVisible()
	await expect(page.getByText('Test upstream unavailable')).toHaveCount(0)
	await context.setExtraHTTPHeaders({})
	await page.getByRole('button', { name: 'Try again' }).click()
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('custom checkout creates a session and recovers from unavailable Stripe.js', async ({
	page,
	context,
}) => {
	test.skip(!provider, 'Uses the isolated Stripe API fixture')
	await context.addCookies([cookie()])
	await page.route('https://js.stripe.com/**', (route) => route.abort())
	await page.goto('/checkout')
	const created = page.waitForResponse(
		(response) =>
			response.url().endsWith('/api/checkout/sessions') && response.request().method() === 'POST',
	)
	await page.getByRole('button', { name: 'Continue to payment' }).click()
	expect((await created).status()).toBe(201)
	await expect(page.getByRole('alert')).toContainText('Unable to load the payment form')
	await expect(page.getByRole('link', { name: 'Back to workspace' })).toBeVisible()
})

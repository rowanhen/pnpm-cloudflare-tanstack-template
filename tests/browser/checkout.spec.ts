import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
const input = z.object({
	product: z.enum(['purchase', 'subscription']),
	requestId: z.uuid(),
	token: z.uuid(),
})

test.beforeEach(async ({ context }) => {
	await context.route('**/*', (route) =>
		new URL(route.request().url()).hostname === 'localhost' ? route.continue() : route.abort(),
	)
	await context.route('https://js.stripe.com/**', (route) =>
		route.fulfill({
			contentType: 'application/javascript',
			path: fileURLToPath(new URL('stripe.js', import.meta.url)),
		}),
	)
})

test.describe('checkout browser flow', () => {
	test('when a buyer retries checkout, storefront prices and buyer proof remain correct', async ({
		page,
		request,
	}) => {
		const response = await request.get('http://localhost:3100/en/checkout')
		expect(response.status()).toBe(200)
		const html = await response.text()
		expect(html).toContain('Example product')
		expect(html).toContain('A guest purchase using Stripe test mode.')
		expect(html).toContain('£12.00')
		expect(html).toContain('application/ld+json')
		expect(html).toContain('noindex')
		expect((await request.get('http://localhost:3101/checkout')).status()).toBe(404)
		const requests: z.infer<typeof input>[] = []
		await page.route('**/api/storefront/checkouts', async (route) => {
			requests.push(input.parse(route.request().postDataJSON()))
			if (requests.length === 1)
				await route.fulfill({ status: 503, json: { code: 'unavailable', error: 'Fixture outage' } })
			else await route.continue()
		})
		await page.goto('http://localhost:3100/en/checkout')
		await page.getByRole('button', { name: 'Buy', exact: true }).click()
		await expect(page.getByText("Couldn't open checkout. Please try again.")).toBeVisible()
		await page.getByRole('button', { name: 'Buy', exact: true }).click()
		await expect(page.getByText('Payment provider test fixture')).toBeVisible()
		expect(requests[1]).toEqual(requests[0])
		await page.getByRole('button', { name: 'Back to products' }).click()
		await page.getByRole('button', { name: 'Buy', exact: true }).click()
		await expect(page.getByText('Payment provider test fixture')).toBeVisible()
		expect(requests[2]).toEqual(requests[0])
		await page.getByLabel('Email', { exact: true }).fill('buyer@example.test')
		await page.getByRole('button', { name: 'Pay £12.00' }).click()
		await expect(page.getByText('Fixture decline. Try again.')).toBeVisible()
		await expect(page.getByRole('button', { name: 'Pay £12.00' })).toBeEnabled()
		let checks = 0
		await page.route('**/api/storefront/status', async (route) => {
			const proof = z
				.object({ token: z.string(), sessionId: z.string() })
				.parse(route.request().postDataJSON())
			expect(proof.token).toBe(requests[0]?.token)
			checks++
			await route.fulfill({
				json: {
					status: checks === 1 ? 'pending' : 'paid',
					mode: 'payment',
					amount: 1200,
					currency: 'gbp',
				},
			})
		})
		await page.getByRole('button', { name: 'Pay £12.00' }).click()
		await expect(page).toHaveURL(/\/en\/checkout\/complete\?session_id=cs_test_/)
		await expect(page.getByRole('heading', { name: 'Your payment is processing.' })).toBeVisible()
		await expect(page.getByRole('heading', { name: 'Payment successful.' })).toBeVisible({
			timeout: 10_000,
		})
		await page.reload()
		await expect(page.getByRole('heading', { name: 'Payment successful.' })).toBeVisible()
		await page.getByRole('link', { name: 'Back to products' }).click()
		await expect(page.getByRole('button', { name: 'Subscribe', exact: true })).toBeVisible()
	})

	test('when checkout proof is missing, confirmation fails and sign-in preserves the return path', async ({
		page,
	}) => {
		await page.goto('http://localhost:3100/en/checkout/complete?session_id=cs_test_unknown')
		await expect(
			page.getByRole('heading', { name: "Couldn't confirm your payment." }),
		).toBeVisible()
		await expect(page.getByRole('button', { name: 'Check again' })).toBeEnabled()
		await page.goto('http://localhost:3101/checkout/success?session_id=cs_test_return')
		await expect(page).toHaveURL(/\/login\?next=checkout-success&session_id=cs_test_return/)
		await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
		await page.goto('/login?next=checkout-success&session_id=cs_test_return&error=cancelled')
		await expect(
			page.getByText('Sign-in was cancelled. Try again when you’re ready.'),
		).toBeVisible()
		await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
	})
})

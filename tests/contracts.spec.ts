import { expect, test } from '@playwright/test'

const dashboard = process.env.E2E_DASHBOARD_URL ?? 'http://localhost:3001'
const cookie = process.env.E2E_COOKIE_ALICE ?? ''

for (const scenario of [
	{
		name: 'declared HTTP failure',
		status: 503,
		body: { code: 'unavailable', error: 'Please try again shortly' },
		message: 'Please try again shortly',
	},
	{
		name: 'incorrect status/error pair',
		status: 503,
		body: { code: 'todo_not_found', error: 'Wrong status' },
		message: 'The API response does not match its contract',
	},
	{
		name: 'invalid success response',
		status: 201,
		body: { todo: { title: 'Incomplete response' } },
		message: 'The API response does not match its contract',
	},
]) {
	test(`generated todo client handles ${scenario.name}`, async ({ page, context }) => {
		const separator = cookie.indexOf('=')
		await context.addCookies([
			{
				name: cookie.slice(0, separator),
				value: cookie.slice(separator + 1),
				url: dashboard,
				httpOnly: true,
				secure: dashboard.startsWith('https:'),
				sameSite: 'Lax',
			},
		])
		await page.goto('/')
		await expect(page.getByRole('heading', { name: 'Todos', exact: true })).toBeVisible()
		await page.route('**/api/todos', async (route) => {
			if (route.request().method() === 'POST')
				await route.fulfill({ status: scenario.status, json: scenario.body })
			else await route.continue()
		})
		await page.getByLabel('Todo title', { exact: true }).fill('Contract example')
		await page.getByRole('button', { name: 'Add todo', exact: true }).click()
		await expect(page.getByText(scenario.message, { exact: true })).toBeVisible()
	})
}

import { test, expect } from '@playwright/test'
import type { ContentBlock } from '../../apps/marketing/src/publishing/model'

test('all publishing blocks render in HTML and Markdown; internal links retain anchor semantics', async ({
	page,
	request,
}) => {
	await page.goto('http://localhost:3100')
	const blocks = {
		paragraph: 'TanStack Start · Drizzle · Composables / Kumo',
		commands: 'Clone',
		features: 'Google sign-in',
		links: 'Setup & deployment',
		waitlist: 'Try the waitlist',
		list: 'Use the template to create your repository.',
	} satisfies Record<ContentBlock['kind'], string>
	const home = await request.get('http://localhost:3100/index.md')
	expect(home.status()).toBe(200)
	expect(home.headers()['content-type']).toContain('text/markdown')
	const markdown = await home.text()
	for (const kind of ['paragraph', 'commands', 'features', 'waitlist'] as const) {
		await expect(page.getByText(blocks[kind], { exact: true })).toBeVisible()
		expect(markdown).toContain(blocks[kind])
	}
	await page.getByRole('link', { name: 'Setup', exact: true }).click()
	await expect(page).toHaveURL(/#setup$/)
	await page.goto('http://localhost:3100/guides/getting-started')
	for (const kind of ['list', 'links'] as const)
		await expect(page.getByText(blocks[kind], { exact: true })).toBeVisible()
	const guide = await request.get('http://localhost:3100/guides/getting-started.md')
	expect(await guide.text()).toContain(blocks.list)
	expect(await guide.text()).toContain('Setup & deployment')
	await page.getByRole('link', { name: 'Privacy', exact: true }).click()
	await expect(page.getByRole('heading', { name: 'Privacy in this demo' })).toBeVisible()
	const llms = await request.get('http://localhost:3100/llms.txt')
	expect(await llms.text()).toContain('/guides/getting-started.md')
})

test('waitlist hydrates, submits locally and navigates to success', async ({ page }) => {
	await page.goto('http://localhost:3100')
	await page.getByLabel('Email address', { exact: true }).fill(`smoke-${Date.now()}@example.test`)
	await page.getByRole('checkbox', { name: 'Save my email in this demo.' }).check()
	await page.getByRole('button', { name: 'Join the waitlist' }).click()
	await expect(page.getByRole('heading', { name: "You're on the list." })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
})

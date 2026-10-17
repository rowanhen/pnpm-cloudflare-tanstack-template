import { expect, test, type Page } from '@playwright/test'
import { gunzipSync } from 'node:zlib'
import {
	consentKey,
	createConsent,
	consentLifetime,
} from '../../packages/observability/src/consent'

test.use({
	storageState: { cookies: [], origins: [] },
	userAgent:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
})

function expandReplay(value: unknown): unknown {
	if (typeof value === 'string' && value.charCodeAt(0) === 31 && value.charCodeAt(1) === 139) {
		const text = gunzipSync(Buffer.from(value, 'latin1')).toString()
		try {
			return expandReplay(JSON.parse(text))
		} catch {
			return text
		}
	}
	if (Array.isArray(value)) return value.map(expandReplay)
	if (value && typeof value === 'object')
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, expandReplay(entry)]),
		)
	return value
}
interface Captured {
	event: string
	properties: Record<string, unknown>
}
async function collect(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'webdriver', { get: () => false })
		Object.defineProperty(navigator, 'userAgentData', { get: () => undefined })
	})
	const events: Captured[] = []
	let requests = 0
	await page.route(/https:\/\/eu(?:-assets)?\.i\.posthog\.com\//, async (route) => {
		requests++
		const request = route.request()
		const url = new URL(request.url())
		const buffer = request.postDataBuffer()
		if (buffer && !url.pathname.includes('flags')) {
			const text =
				buffer[0] === 31 && buffer[1] === 139 ? gunzipSync(buffer).toString() : buffer.toString()
			const decoded: unknown = JSON.parse(text)
			const batch = Array.isArray(decoded)
				? decoded
				: decoded &&
					  typeof decoded === 'object' &&
					  'batch' in decoded &&
					  Array.isArray(decoded.batch)
					? decoded.batch
					: [decoded]
			for (const event of batch) if (event?.event) events.push(event)
		}
		await route.fulfill({
			json: {
				status: 1,
				featureFlags: {},
				supportedCompression: [],
				sessionRecording: { endpoint: '/s/', sampleRate: 1, minimumDurationMilliseconds: 0 },
			},
		})
	})
	return { events, requests: () => requests }
}
test.skip(
	Boolean(process.env.E2E_MARKETING_URL),
	'Local capture fixtures never send test data to the live analytics project',
)

test('analytics waits for consent, scrubs replay/errors and stops after withdrawal', async ({
	page,
}) => {
	const telemetry = await collect(page)
	await page.goto('http://localhost:3000/?email=privacy-sentinel@example.test#secret-sentinel')
	await expect(page.getByRole('button', { name: 'Accept all', exact: true })).toBeVisible()
	expect(telemetry.requests()).toBe(0)
	await page.getByRole('button', { name: 'Reject all', exact: true }).click()
	await page.reload()
	await expect(page.getByRole('button', { name: 'Privacy preferences', exact: true })).toBeVisible()
	expect(telemetry.requests()).toBe(0)
	await page.getByRole('button', { name: 'Privacy preferences', exact: true }).click()
	await page.getByRole('button', { name: 'Accept all', exact: true }).click()
	await expect
		.poll(() => telemetry.events.filter((e) => e.event === '$pageview').length, { timeout: 15000 })
		.toBe(1)
	await page.locator('input[type=email]').fill('form-sentinel@example.test')
	await page.evaluate(() => {
		const error = new TypeError('error-sentinel@example.test')
		window.dispatchEvent(new ErrorEvent('error', { error }))
	})
	await expect.poll(() => telemetry.events.some((e) => e.event === '$exception')).toBe(true)
	await expect
		.poll(() => telemetry.events.some((e) => e.event === '$snapshot'), { timeout: 20000 })
		.toBe(true)
	const serialized = JSON.stringify(expandReplay(telemetry.events))
	expect(serialized).not.toMatch(/privacy-sentinel|secret-sentinel|form-sentinel|error-sentinel/)
	expect(telemetry.events.find((e) => e.event === '$pageview')?.properties.$current_url).toBe(
		'http://localhost:3000/',
	)
	await page.getByRole('button', { name: 'Privacy preferences', exact: true }).click()
	await page.getByRole('button', { name: 'Reject all', exact: true }).click()
	await page.reload()
	const count = telemetry.requests()
	await expect(page.getByRole('button', { name: 'Privacy preferences', exact: true })).toBeVisible()
	expect(telemetry.requests()).toBe(count)
	const views = telemetry.events.filter((e) => e.event === '$pageview').length
	await page.getByRole('button', { name: 'Privacy preferences', exact: true }).click()
	await page.getByRole('button', { name: 'Accept all', exact: true }).click()
	await expect
		.poll(() => telemetry.events.filter((e) => e.event === '$pageview').length)
		.toBe(views + 1)
})

test('dashboard uses opaque identity and correlates API failures without request contents', async ({
	page,
	context,
}) => {
	const cookie = process.env.E2E_COOKIE_BOB ?? ''
	await context.addCookies([
		{
			name: cookie.split('=')[0],
			value: cookie.slice(cookie.indexOf('=') + 1),
			url: 'http://localhost:3001',
			httpOnly: true,
			sameSite: 'Lax',
		},
	])
	const telemetry = await collect(page)
	await page.goto('/')
	await page.getByRole('button', { name: 'Accept all', exact: true }).click()
	await expect
		.poll(() => telemetry.events.some((e) => e.event === '$identify'), { timeout: 15000 })
		.toBe(true)
	const requestId = crypto.randomUUID()
	await page.route('**/api/todos', (route) =>
		route.fulfill({
			status: 503,
			headers: { 'x-request-id': requestId },
			json: { error: 'upstream-sentinel' },
		}),
	)
	await page.getByPlaceholder('New todo').fill('private-todo-sentinel')
	await page.getByRole('button', { name: 'Add todo', exact: true }).click()
	await expect.poll(() => telemetry.events.some((e) => e.event === 'api.request.failed')).toBe(true)
	expect(telemetry.events.find((e) => e.event === 'api.request.failed')?.properties).toMatchObject({
		status: 503,
		route: '/api/todos',
		request_id: requestId,
	})
	expect(JSON.stringify(telemetry.events)).not.toMatch(
		/alice@example|private-todo-sentinel|upstream-sentinel/,
	)
	await page.getByRole('button', { name: 'Sign out', exact: true }).click()
	await expect(page).toHaveURL(/\/login$/)
	await expect
		.poll(() =>
			telemetry.events.some((e) => e.event === '$pageview' && e.properties.$pathname === '/login'),
		)
		.toBe(true)
	const before = telemetry.events.find((e) => e.event === '$identify')?.properties.distinct_id
	const after = telemetry.events.find(
		(e) => e.event === '$pageview' && e.properties.$pathname === '/login',
	)?.properties.distinct_id
	expect(after).not.toBe(before)
})

test('an initial server-rendered error is captured after the SDK becomes ready', async ({
	page,
	context,
}) => {
	const telemetry = await collect(page)
	await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
		key: consentKey,
		value: JSON.stringify(createConsent({ analytics: true, replay: true })),
	})
	await context.setExtraHTTPHeaders({ 'x-test-session-failure': 'true' })
	await page.goto('/login')
	await expect(page.getByRole('heading', { name: "Couldn't load this page" })).toBeVisible()
	await expect
		.poll(() =>
			telemetry.events.some(
				(event) => event.event === '$exception' && event.properties.source === 'route',
			),
		)
		.toBe(true)
})

test('analytics can be allowed without session replay', async ({ page }) => {
	const telemetry = await collect(page)
	await page.goto('http://localhost:3000/')
	await page.getByRole('button', { name: 'Manage', exact: true }).click()
	await expect(page.getByRole('checkbox', { name: 'Analytics', exact: true })).not.toBeChecked()
	await expect(
		page.getByRole('checkbox', { name: 'Session replay', exact: true }),
	).not.toBeChecked()
	await page.getByRole('checkbox', { name: 'Analytics', exact: true }).check()
	await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
	await expect.poll(() => telemetry.events.some((e) => e.event === '$pageview')).toBe(true)
	await page.locator('input[type=email]').fill('do-not-record@example.test')
	await page.waitForTimeout(2500)
	expect(telemetry.events.some((e) => e.event === '$snapshot')).toBe(false)
	const record = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
		consentKey,
	)
	expect(record).toMatchObject({ version: 2, analytics: true, replay: false, source: 'user' })
	expect(record.expiresAt).toBeGreaterThan(record.updatedAt)
	await page.reload()
	await page.getByRole('button', { name: 'Privacy preferences', exact: true }).click()
	await expect(page.getByRole('checkbox', { name: 'Analytics', exact: true })).toBeChecked()
	await expect(
		page.getByRole('checkbox', { name: 'Session replay', exact: true }),
	).not.toBeChecked()
})

test('replay can be allowed without analytics or account identification', async ({ page }) => {
	const telemetry = await collect(page)
	await page.goto('http://localhost:3000/')
	await page.getByRole('button', { name: 'Manage', exact: true }).click()
	await page.getByRole('checkbox', { name: 'Session replay', exact: true }).check()
	await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
	await page.locator('input[type=email]').fill('replay-only-private@example.test')
	await expect
		.poll(() => telemetry.events.some((e) => e.event === '$snapshot'), { timeout: 20000 })
		.toBe(true)
	expect(telemetry.events.every((e) => e.event === '$snapshot')).toBe(true)
	expect(JSON.stringify(expandReplay(telemetry.events))).not.toContain('replay-only-private')
})

test('Global Privacy Control overrides an earlier acceptance and remembers rejection', async ({
	page,
}) => {
	const telemetry = await collect(page)
	await page.addInitScript(
		({ key, value }) => {
			localStorage.setItem(key, value)
			Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true })
		},
		{ key: consentKey, value: JSON.stringify(createConsent({ analytics: true, replay: true })) },
	)
	await page.goto('http://localhost:3000/')
	await page.getByRole('button', { name: 'Privacy preferences', exact: true }).click()
	await expect(
		page.getByRole('status').filter({ hasText: 'Global Privacy Control is on' }),
	).toBeVisible()
	await expect(page.getByRole('button', { name: 'Accept all', exact: true })).toBeDisabled()
	await expect(page.getByRole('checkbox', { name: 'Analytics', exact: true })).toBeDisabled()
	await expect(
		page.getByRole('checkbox', { name: 'Session replay', exact: true }),
	).not.toBeChecked()
	expect(telemetry.requests()).toBe(0)
	const record = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
		consentKey,
	)
	expect(record).toMatchObject({ analytics: false, replay: false, source: 'gpc' })
})

for (const [name, storedValue] of [
	[
		'expired',
		JSON.stringify(
			createConsent({ analytics: true, replay: true }, Date.now() - consentLifetime - 1000),
		),
	],
	['malformed', '{bad-json'],
	[
		'unsupported version',
		JSON.stringify({ ...createConsent({ analytics: true, replay: true }), version: 99 }),
	],
] as const) {
	test(`${name} consent never enables tracking`, async ({ page }) => {
		const telemetry = await collect(page)
		await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
			key: consentKey,
			value: storedValue,
		})
		await page.goto('http://localhost:3000/')
		await expect(page.getByRole('button', { name: 'Reject all', exact: true })).toBeVisible()
		expect(telemetry.requests()).toBe(0)
	})
}

test('withdrawing in another tab stops tracking and clears SDK identifiers', async ({
	page,
	context,
}) => {
	const telemetry = await collect(page)
	await page.goto('http://localhost:3000/')
	await page.getByRole('button', { name: 'Accept all', exact: true }).click()
	await expect.poll(() => telemetry.events.some((e) => e.event === '$pageview')).toBe(true)
	const other = await context.newPage()
	await collect(other)
	await other.goto('http://localhost:3000/')
	await other.getByRole('button', { name: 'Privacy preferences', exact: true }).click()
	await other.getByRole('button', { name: 'Reject all', exact: true }).click()
	await expect
		.poll(() =>
			page.evaluate(() => Object.keys(localStorage).filter((key) => /^ph_.*_posthog$/.test(key))),
		)
		.toEqual([])
	const count = telemetry.requests()
	await page.evaluate(() =>
		window.dispatchEvent(new ErrorEvent('error', { error: new Error('after-withdrawal') })),
	)
	await page.waitForTimeout(2500)
	expect(telemetry.requests()).toBe(count)
	await other.close()
})

test('blocked storage leaves the site usable and rejects tracking', async ({ page }) => {
	const telemetry = await collect(page)
	await page.addInitScript(() => {
		Storage.prototype.getItem = () => {
			throw new Error('Storage blocked')
		}
		Storage.prototype.setItem = () => {
			throw new Error('Storage blocked')
		}
	})
	await page.goto('http://localhost:3000/')
	await page.getByRole('button', { name: 'Reject all', exact: true }).click()
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('CloudflareStarter')
	await page.getByRole('button', { name: 'Privacy preferences', exact: true }).click()
	await expect(page.getByRole('checkbox', { name: 'Analytics', exact: true })).not.toBeChecked()
	expect(telemetry.requests()).toBe(0)
})

test('consent controls fit a phone and offer the same accept and reject styles', async ({
	page,
}) => {
	await collect(page)
	await page.setViewportSize({ width: 375, height: 812 })
	await page.goto('http://localhost:3000/')
	const accept = page.getByRole('button', { name: 'Accept all', exact: true })
	const reject = page.getByRole('button', { name: 'Reject all', exact: true })
	expect(await accept.getAttribute('class')).toBe(await reject.getAttribute('class'))
	await page.screenshot({ path: 'test-results/consent-mobile.png', animations: 'disabled' })
	await page.getByRole('button', { name: 'Manage', exact: true }).click()
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
	await expect(page.getByRole('button', { name: 'Save preferences', exact: true })).toBeInViewport()
	await page.screenshot({
		path: 'test-results/consent-preferences-mobile.png',
		animations: 'disabled',
	})
})

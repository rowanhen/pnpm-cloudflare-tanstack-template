import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('dashboard creates and completes a D1 todo and uploads/downloads an R2 file', async ({
	page,
	request,
}) => {
	const title = `Browser todo ${Date.now()}`
	const filename = process.env.E2E_API_URL ? 'e2e-browser.txt' : `browser-${Date.now()}.txt`
	const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:8787'
	const apiToken = process.env.E2E_API_TOKEN
	const options = { headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {} }
	const contents = 'Browser to Worker to R2 and back.\n'
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	try {
		await page.goto('/')
		await expect(page.getByRole('heading', { name: 'D1 todos' })).toBeVisible()
		if (apiToken)
			await page.getByLabel('API token (cloud deployments only)', { exact: true }).fill(apiToken)
		await page.getByLabel('Todo title', { exact: true }).fill(title)
		await page.getByRole('button', { name: 'Add todo', exact: true }).click()
		const checkbox = page.getByRole('checkbox', { name: title, exact: true })
		await expect(checkbox).toBeVisible()
		await checkbox.click()
		await expect(checkbox).toBeChecked()
		await page.reload()
		if (apiToken)
			await page.getByLabel('API token (cloud deployments only)', { exact: true }).fill(apiToken)
		await expect(checkbox).toBeChecked()
		await page
			.getByLabel('File', { exact: true })
			.setInputFiles({ name: filename, mimeType: 'text/plain', buffer: Buffer.from(contents) })
		await page.getByRole('button', { name: 'Upload file', exact: true }).click()
		const downloadButton = page.getByRole('button', { name: `Download ${filename}`, exact: true })
		await expect(downloadButton).toBeVisible()
		const downloadPromise = page.waitForEvent('download')
		await downloadButton.click()
		const download = await downloadPromise
		expect(download.suggestedFilename()).toBe(filename)
		const path = await download.path()
		if (!path) throw new Error('Download path missing')
		expect(await readFile(path, 'utf8')).toBe(contents)
		await page.getByRole('button', { name: `Delete file ${filename}`, exact: true }).click()
		await expect(downloadButton).toHaveCount(0)
		await page.getByRole('button', { name: `Delete todo ${title}`, exact: true }).click()
		await expect(checkbox).toHaveCount(0)
		await expect(page.getByRole('alert')).toHaveCount(0)
		expect(errors).toEqual([])
	} finally {
		await request.delete(`${apiUrl}/api/files/${filename}`, options)
		const response = await request.get(`${apiUrl}/api/todos`, options)
		const { todos } = await response.json()
		for (const todo of todos)
			if (todo.title === title) await request.delete(`${apiUrl}/api/todos/${todo.id}`, options)
	}
})

test('marketing production page renders and hydrates', async ({ page }) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await page.goto('http://localhost:3000')
	await expect(page.getByRole('heading', { name: 'Backend', exact: true })).toBeVisible()
	await expect(
		page.getByText(
			'D1 SQL todo CRUD and R2 file storage, with working REST examples in the dashboard.',
		),
	).toBeVisible()
	expect(errors).toEqual([])
})

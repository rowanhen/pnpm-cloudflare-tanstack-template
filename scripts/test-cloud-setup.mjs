import { spawnSync } from 'node:child_process'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { parseEnv } from 'node:util'
import { root, setupEnv } from './setup-env.mjs'
const slug = `setup-${Date.now()}`
const env = await setupEnv()
const directory = resolve(root, '.wrangler', 'sandboxes', slug)
const run = (args) => {
	const result = spawnSync('pnpm', args, { cwd: root, env, stdio: 'inherit', timeout: 300000 })
	if (result.error || result.status !== 0)
		throw new Error(`Setup test command failed: pnpm ${args.join(' ')}`)
}
const state = async () => JSON.parse(await readFile(resolve(directory, 'resources.json'), 'utf8'))
try {
	run(['cloud:up', slug])
	const first = await state()
	const secrets = parseEnv(await readFile(resolve(directory, 'secrets.env'), 'utf8'))
	const objectFile = resolve(directory, 'cleanup-fixture.txt')
	await writeFile(objectFile, 'This nested object must be removed by sandbox teardown.\n')
	run([
		'exec',
		'wrangler',
		'r2',
		'object',
		'put',
		`${first.bucket}/arbitrary-user/nested/file.txt`,
		'--remote',
		'--file',
		objectFile,
	])
	await rm(objectFile)
	run(['cloud:up', slug])
	const second = await state()
	assert.equal(second.databaseId, first.databaseId)
	assert.equal(second.name, first.name)
	assert.equal(second.bucket, first.bucket)
	const reused = parseEnv(await readFile(resolve(directory, 'secrets.env'), 'utf8'))
	assert.equal(reused.BETTER_AUTH_SECRET, secrets.BETTER_AUTH_SECRET)
	assert.equal(reused.API_PROXY_SECRET, secrets.API_PROXY_SECRET)
	run(['cloud:check', slug])
	console.log(
		'PASS cloud setup: real provisioning, rerun preserves resource IDs and secrets, deployed smoke checks',
	)
} finally {
	run(['cloud:down', slug])
	console.log(
		'PASS cloud teardown: arbitrary nested R2 object removed; all resource absence checks passed',
	)
}

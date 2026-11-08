import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
const root = fileURLToPath(new URL('../..', import.meta.url))

test('LinkButton retains dashboard route, required search and anchor-ref types', async (t) => {
	const directory = await mkdtemp(join(tmpdir(), 'link-button-types-'))
	t.after(() => rm(directory, { recursive: true, force: true }))
	await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')
	await writeFile(
		join(directory, 'tsconfig.json'),
		JSON.stringify({
			extends: join(root, 'apps/dashboard/tsconfig.json'),
			include: ['link.tsx'],
		}),
	)
	const imports = `import '${root}/apps/dashboard/src/router.tsx'
import { LinkButton } from '${root}/packages/shared/src/components/link-button.tsx'
import { createRef } from 'react'
const ref = createRef<HTMLAnchorElement>(); void ref
`
	for (const [jsx, allowed] of [
		[
			'<LinkButton to="/checkout/complete" search={{ session_id: "cs_test_ok" }} ref={ref}>Payment</LinkButton>',
			true,
		],
		['<LinkButton to="/does-not-exist">Invalid route</LinkButton>', false],
		['<LinkButton to="/checkout/complete">Missing search</LinkButton>', false],
		[
			'<LinkButton to="/checkout/complete" search={{ session_id: 123 }}>Invalid search</LinkButton>',
			false,
		],
	] as const) {
		await writeFile(join(directory, 'link.tsx'), imports + `export const link = ${jsx}\n`)
		const result = spawnSync('pnpm', ['exec', 'tsc', '-p', join(directory, 'tsconfig.json')], {
			cwd: root,
			encoding: 'utf8',
		})
		assert.ifError(result.error)
		if (allowed) assert.equal(result.status, 0, result.stdout + result.stderr)
		else {
			assert.notEqual(result.status, 0, result.stdout + result.stderr)
			assert.match(result.stdout, /link\.tsx.*error TS(?:2322|2741)/)
		}
	}
})

import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { root } from './setup-env.ts'
// Git needs an executable launcher. All checks and installation logic live in TypeScript/package scripts.
const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
	cwd: root,
	encoding: 'utf8',
}).trim()
const directory = resolve(gitRoot, '.githooks')
await mkdir(directory, { recursive: true })
await writeFile(resolve(directory, 'pre-commit'), '#!/bin/sh\nexec pnpm run precommit:check\n', {
	mode: 0o755,
})
execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: gitRoot })
console.log('Pre-commit hook installed.')

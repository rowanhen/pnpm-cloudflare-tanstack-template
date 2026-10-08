import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { root } from './setup-env.ts'

// Include new source files, ignore dependencies/builds, and tolerate pending Git deletions.
const files = execFileSync(
	'git',
	['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
	{
		cwd: root,
		encoding: 'utf8',
	},
).split('\0')
const javascript = files.filter(
	(file) => /\.(?:[cm]?js|jsx)$/.test(file) && existsSync(resolve(root, file)),
)
if (javascript.length)
	throw new Error(`Use TypeScript for repository source:\n${javascript.join('\n')}`)
console.log('All repository JavaScript source is authored in TypeScript.')

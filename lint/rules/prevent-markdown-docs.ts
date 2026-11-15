import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
	encoding: 'utf8',
})
if (result.error) throw result.error
if (result.status !== 0) throw new Error(result.stderr || 'Could not list project files')

const markdownFiles = [...new Set(result.stdout.split('\0'))]
	.filter((path) => /\.mdx?$/i.test(path) && existsSync(path))
	.sort()

for (const path of markdownFiles) {
	console.warn(
		`${path}:1:1 warning project/prevent-markdown-docs: Review whether this Markdown document is needed.`,
	)
}

console.log(`Project Markdown lint: ${markdownFiles.length} warning(s).`)

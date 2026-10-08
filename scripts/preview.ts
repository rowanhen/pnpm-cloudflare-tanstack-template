import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const [app, port] = process.argv.slice(2)
if (!['marketing', 'dashboard'].includes(app) || !/^\d+$/.test(port))
	throw new Error('Usage: preview.ts marketing|dashboard PORT')
const args = ['exec', 'wrangler', 'pages', 'dev', 'dist', '--port', port]
if (process.env.E2E_PROXY_SECRET)
	args.push('--binding', `API_PROXY_SECRET=${process.env.E2E_PROXY_SECRET}`)
const child = spawn('pnpm', args, {
	cwd: fileURLToPath(new URL(`../apps/${app}`, import.meta.url)),
	stdio: 'inherit',
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => child.kill(signal))
child.on('exit', (code) => {
	process.exitCode = code ?? 1
})

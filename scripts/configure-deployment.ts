import { readFile, writeFile } from 'node:fs/promises'
import { z } from 'zod'

const apiConfig = z
	.object({ name: z.string().min(1), vars: z.record(z.string(), z.string()) })
	.passthrough()
	.parse(JSON.parse(await readFile('apps/api/wrangler.ci.json', 'utf8')))
const siteUrl = z.url().parse(process.env.VITE_SITE_URL)
apiConfig.vars.SITE_URL = siteUrl.replace(/\/$/, '')

const apps = await Promise.all(
	(['marketing', 'dashboard'] as const).map(async (app) => {
		const path = `apps/${app}/wrangler.json`
		const config = z
			.object({
				services: z
					.array(z.object({ binding: z.literal('API'), service: z.string() }).passthrough())
					.length(1),
			})
			.passthrough()
			.parse(JSON.parse(await readFile(path, 'utf8')))
		config.services[0].service = apiConfig.name
		return { path, config }
	}),
)

await writeFile('apps/api/wrangler.ci.json', `${JSON.stringify(apiConfig, null, '\t')}\n`)
for (const { path, config } of apps)
	await writeFile(path, `${JSON.stringify(config, null, '\t')}\n`)

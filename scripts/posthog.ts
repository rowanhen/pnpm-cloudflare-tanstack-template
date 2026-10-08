import { readFile, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { envPath, setupEnv } from './setup-env.ts'

const env = await setupEnv()
const action = process.argv[2]
if (!['setup', 'report'].includes(action))
	throw new Error('Usage: pnpm posthog:setup|posthog:report')
const host = z
	.enum(['https://eu.posthog.com', 'https://us.posthog.com'])
	.parse(env.POSTHOG_MANAGEMENT_HOST)
const token = z.string().min(10).parse(env.POSTHOG_PERSONAL_API_KEY)
const organization = z.uuid().parse(env.POSTHOG_ORGANIZATION_ID)
const environment = z
	.string()
	.regex(/^[a-z][a-z0-9-]{0,31}$/)
	.parse(env.APP_ENV ?? 'production')
const projectSchema = z.object({
	id: z.number(),
	name: z.string(),
	organization: z.string(),
	api_token: z.string().startsWith('phc_'),
})
const recordSchema = z.object({
	id: z.number(),
	name: z.string().nullable(),
	tags: z.array(z.string()).optional(),
})
async function api(path: string, method = 'GET', body?: unknown): Promise<unknown> {
	const url = new URL(path, host)
	if (url.origin !== host || !url.pathname.startsWith('/api/'))
		throw new Error('Invalid PostHog API URL')
	const response = await fetch(url, {
		method,
		redirect: 'error',
		signal: AbortSignal.timeout(20000),
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	})
	if (!response.ok)
		throw new Error(
			`PostHog ${method} failed (HTTP ${response.status}); check project scope and API key permissions`,
		)
	return response.json()
}
async function list(path: string) {
	const results: z.infer<typeof recordSchema>[] = []
	let next: string | null = path
	while (next) {
		const page = z
			.object({ results: z.array(recordSchema), next: z.string().nullable() })
			.parse(await api(next))
		results.push(...page.results)
		next = page.next
	}
	return results
}
const organizationPath = `/api/organizations/${organization}/projects/`
let projectId = env.POSTHOG_PROJECT_ID
	? z.coerce.number().int().positive().parse(env.POSTHOG_PROJECT_ID)
	: undefined
if (!projectId) {
	if (action !== 'setup') throw new Error('Run posthog:setup or set POSTHOG_PROJECT_ID first')
	const name = env.POSTHOG_PROJECT_NAME ?? 'Cloudflare Starter'
	const projects = await list(organizationPath)
	const matches = projects.filter((project) => project.name === name)
	if (matches.length > 1) throw new Error('Multiple matching projects; set POSTHOG_PROJECT_ID')
	projectId =
		matches[0]?.id ?? projectSchema.parse(await api(organizationPath, 'POST', { name })).id
}
const project = projectSchema.parse(await api(`${organizationPath}${projectId}/`))
if (project.organization !== organization || project.id !== projectId)
	throw new Error('PostHog project scope mismatch')
const base = `/api/projects/${project.id}`
const where = `timestamp >= now() - INTERVAL 7 DAY AND properties.environment = '${environment}'`
const reports = [
	{
		name: 'Engagement',
		sql: `SELECT event, properties.app AS app, count() AS total FROM events WHERE ${where} AND event IN ('$pageview', 'template.opened', 'waitlist.joined', 'api.request.failed') GROUP BY event, app ORDER BY total DESC`,
	},
	{
		name: 'API health',
		sql: `SELECT properties.route AS route, count() AS requests, countIf(toInt(properties.status) >= 500) AS server_errors, countIf(toInt(properties.status) = 429) AS rate_limited, quantile(0.95)(toFloat(properties.duration_ms)) AS p95_ms FROM events WHERE ${where} AND event = 'api.request' GROUP BY route ORDER BY requests DESC`,
	},
	{
		name: 'Errors',
		sql: `SELECT properties.app AS app, properties.route AS route, count() AS errors FROM events WHERE ${where} AND event = '$exception' GROUP BY app, route ORDER BY errors DESC`,
	},
]
if (action === 'report') {
	const results = []
	for (const report of reports)
		results.push({
			name: report.name,
			data: await api(`${base}/query/`, 'POST', {
				query: { kind: 'HogQLQuery', query: report.sql },
			}),
		})
	console.log(
		JSON.stringify(
			{ project: project.name, environment, period: 'last 7 days', reports: results },
			null,
			2,
		),
	)
} else {
	// This command explicitly configures the chosen project for the starter's privacy defaults.
	await api(`${organizationPath}${project.id}/`, 'PATCH', {
		session_recording_opt_in: true,
		anonymize_ips: true,
		capture_console_log_opt_in: false,
	})
	const tag = 'cloudflare-starter-observability-v1'
	const name = `Starter · ${environment}`
	const dashboards = await list(`${base}/dashboards/?limit=100`)
	const dashboard =
		dashboards.find((entry) => entry.name === name && entry.tags?.includes(tag)) ??
		recordSchema.parse(
			await api(`${base}/dashboards/`, 'POST', {
				name,
				tags: [tag],
				description: 'Engagement, API health and errors over the last 7 days.',
			}),
		)
	const insights = await list(`${base}/insights/?limit=100`)
	for (const report of reports) {
		const insightName = `${name} · ${report.name}`
		if (insights.some((entry) => entry.name === insightName && entry.tags?.includes(tag))) continue
		await api(`${base}/insights/`, 'POST', {
			name: insightName,
			tags: [tag],
			saved: true,
			dashboards: [dashboard.id],
			query: { kind: 'DataTableNode', source: { kind: 'HogQLQuery', query: report.sql } },
		})
	}
	const values = {
		POSTHOG_KEY: project.api_token,
		POSTHOG_HOST: host.replace('.posthog.com', '.i.posthog.com'),
		POSTHOG_PROJECT_ID: String(project.id),
	}
	const previous = await readFile(envPath, 'utf8').catch((error: unknown) => {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return ''
		throw error
	})
	const kept = previous
		.split('\n')
		.filter((line) => !Object.keys(values).some((key) => line.startsWith(`${key}=`)))
		.join('\n')
		.trimEnd()
	await writeFile(
		envPath,
		`${kept}\n${Object.entries(values)
			.map(([key, value]) => `${key}=${JSON.stringify(value)}`)
			.join('\n')}\n`,
		{ mode: 0o600 },
	)
	console.log(
		JSON.stringify(
			{
				project: project.name,
				projectId: project.id,
				dashboard: `${host}/project/${project.id}/dashboard/${dashboard.id}`,
				replay: `${host}/project/${project.id}/replay`,
				errors: `${host}/project/${project.id}/error_tracking`,
				next: 'pnpm setup:local; then pnpm cloud:up NAME to deploy',
				ingestionVerified: false,
			},
			null,
			2,
		),
	)
}

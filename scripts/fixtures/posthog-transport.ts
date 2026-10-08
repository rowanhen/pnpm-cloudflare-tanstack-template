import { readFile, writeFile } from 'node:fs/promises'
import { z } from 'zod'

const record = z.object({ id: z.number(), name: z.string(), tags: z.array(z.string()).optional() })
const stateSchema = z.object({
	projects: z.array(record),
	dashboards: z.array(record),
	insights: z.array(record),
	writes: z.number(),
})
const path = z.string().parse(process.env.TEST_POSTHOG_STATE)
globalThis.fetch = async (input, init) => {
	const url = new URL(String(input))
	if (url.origin !== 'https://eu.posthog.com') throw new Error('Unexpected test request')
	const state = stateSchema.parse(JSON.parse(await readFile(path, 'utf8')))
	const body = init?.body ? JSON.parse(String(init.body)) : undefined
	let result: unknown
	const kind = url.pathname.endsWith('/projects/')
		? 'projects'
		: url.pathname.endsWith('/dashboards/')
			? 'dashboards'
			: url.pathname.endsWith('/insights/')
				? 'insights'
				: null
	const project = {
		id: 123,
		name: 'Cloudflare Starter',
		organization: process.env.TEST_POSTHOG_BAD_SCOPE
			? 'wrong-organization'
			: process.env.POSTHOG_ORGANIZATION_ID,
		api_token: 'phc_fixture',
	}
	if (kind) {
		if (init?.method === 'POST') {
			const entry = {
				id: kind === 'projects' ? 123 : state[kind].length + 1,
				name: body.name,
				tags: body.tags,
			}
			state[kind].push(entry)
			state.writes++
			result = kind === 'projects' ? project : entry
		} else result = { results: state[kind], next: null }
	} else if (url.pathname.endsWith('/query/')) result = { columns: ['total'], results: [[0]] }
	else if (url.pathname.endsWith('/projects/123/')) result = project
	else throw new Error('Unexpected PostHog API path')
	await writeFile(path, JSON.stringify(state))
	return Response.json(result)
}

import { z } from 'zod'

const envelope = z.object({
	success: z.boolean(),
	result: z.unknown().optional(),
	errors: z.array(z.object({ code: z.number(), message: z.string().optional() })).optional(),
})
export const databases = z.array(z.object({ uuid: z.string(), name: z.string() }))
export const database = databases.element
export const buckets = z.object({ buckets: z.array(z.object({ name: z.string() })) })
export const workers = z.array(z.object({ id: z.string() }))
export const subdomain = z.object({ subdomain: z.string().nullable() })

export function cloudflareApi(token: string, prefix = '') {
	async function request(
		path: string,
		method = 'GET',
		body?: unknown,
		missingOk = false,
	): Promise<unknown> {
		const response = await fetch(`https://api.cloudflare.com/client/v4${prefix}${path}`, {
			method,
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(30000),
		})
		if (missingOk && response.status === 404) return null
		const payload = envelope.parse(await response.json())
		if (!response.ok || !payload.success)
			throw new Error(
				`Cloudflare ${method} ${path}: HTTP ${response.status}; codes ${(payload.errors ?? []).map((error) => error.code).join(',')}`,
			)
		return payload.result
	}
	return Object.assign(request, {
		async read<T extends z.ZodType>(path: string, schema: T): Promise<z.output<T>> {
			return schema.parse(await request(path))
		},
	})
}

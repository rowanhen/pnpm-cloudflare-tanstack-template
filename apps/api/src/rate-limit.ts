import { database } from '@workspace/data/client'
import { rateLimits } from '@workspace/data/schema'
import { sql } from 'drizzle-orm'
import { HttpError } from './http'

// Atomic D1 upsert: concurrent requests and different Worker instances share one counter.
export async function rateLimit(db: D1Database, key: string, limit: number, seconds = 60) {
	const now = Math.floor(Date.now() / 1000)
	const window = Math.floor(now / seconds) * seconds
	const result = await database(db)
		.insert(rateLimits)
		.values({ key, window_start: window, count: 1 })
		.onConflictDoUpdate({
			target: rateLimits.key,
			set: {
				count: sql`CASE WHEN ${rateLimits.window_start} = ${window} THEN ${rateLimits.count} + 1 ELSE 1 END`,
				window_start: window,
			},
			setWhere: sql`${rateLimits.window_start} != ${window} OR ${rateLimits.count} < ${limit}`,
		})
		.returning({ count: rateLimits.count })
		.get()
	const headers = {
		'X-RateLimit-Limit': String(limit),
		'X-RateLimit-Remaining': String(Math.max(0, limit - (result?.count ?? limit))),
		'X-RateLimit-Reset': String(window + seconds),
	}
	if (!result)
		throw new HttpError(429, 'Too many requests. Please try again shortly.', {
			...headers,
			'Retry-After': String(window + seconds - now),
		})
	return headers
}

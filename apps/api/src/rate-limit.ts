import { HttpError } from './http'

// Atomic D1 upsert: concurrent requests and different Worker instances share one counter.
export async function rateLimit(db: D1Database, key: string, limit: number, seconds = 60) {
	const now = Math.floor(Date.now() / 1000)
	const window = Math.floor(now / seconds) * seconds
	const result = await db
		.prepare(`
  INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
  ON CONFLICT(key) DO UPDATE SET
   count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
   window_start = excluded.window_start
  WHERE rate_limits.window_start != excluded.window_start OR rate_limits.count < ?
  RETURNING count
 `)
		.bind(key, window, limit)
		.first<{ count: number }>()
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

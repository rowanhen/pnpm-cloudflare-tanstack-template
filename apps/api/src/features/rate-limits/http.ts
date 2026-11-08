import type { Quota } from './rate-limits'
export const rateLimitHeaders = (quota: Quota) => ({
	'X-RateLimit-Limit': String(quota.limit),
	'X-RateLimit-Remaining': String(quota.remaining),
	'X-RateLimit-Reset': String(quota.reset),
})

export const consentKey = 'starter.privacy-consent.v2'
export const consentVersion = 2
// A template default, not a universal legal expiry period.
export const consentLifetime = 180 * 24 * 60 * 60 * 1000
export interface ConsentPreferences {
	analytics: boolean
	replay: boolean
}
export interface Consent extends ConsentPreferences {
	version: typeof consentVersion
	updatedAt: number
	expiresAt: number
	source: 'user' | 'gpc'
}
export function createConsent(
	preferences: ConsentPreferences,
	now = Date.now(),
	source: Consent['source'] = 'user',
): Consent {
	return {
		...preferences,
		version: consentVersion,
		updatedAt: now,
		expiresAt: now + consentLifetime,
		source,
	}
}
export function parseConsent(value: string | null, now = Date.now()): Consent | null {
	if (!value) return null
	try {
		const data: unknown = JSON.parse(value)
		if (!data || typeof data !== 'object') return null
		const record = data as Partial<Consent>
		if (
			record.version !== consentVersion ||
			typeof record.analytics !== 'boolean' ||
			typeof record.replay !== 'boolean' ||
			typeof record.updatedAt !== 'number' ||
			typeof record.expiresAt !== 'number' ||
			!Number.isFinite(record.updatedAt) ||
			!Number.isFinite(record.expiresAt) ||
			record.updatedAt > now ||
			record.expiresAt <= now ||
			record.expiresAt <= record.updatedAt ||
			record.expiresAt - record.updatedAt > consentLifetime ||
			(record.source !== 'user' && record.source !== 'gpc')
		)
			return null
		return record as Consent
	} catch {
		return null
	}
}

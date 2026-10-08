// Route templates keep IDs, filenames, unknown paths and query strings out of telemetry.
const pages = new Set([
	'/',
	'/login',
	'/checkout',
	'/checkout/success',
	'/waitlist/success',
	'/privacy',
	'/error',
])
const endpoints = new Set([
	'/api/health',
	'/api/config',
	'/api/me',
	'/api/billing',
	'/api/todos',
	'/api/files',
	'/api/keys',
	'/api/email',
	'/api/waitlist',
	'/api/waitlist/me',
	'/api/v1/todos',
	'/api/v1/summary',
	'/api/checkout/config',
	'/api/checkout/sessions',
	'/api/stripe/webhook',
])
export function safePath(path: string) {
	if (pages.has(path) || endpoints.has(path)) return path
	if (path.startsWith('/api/auth/')) return '/api/auth/:action'
	for (const prefix of ['/api/todos/', '/api/files/', '/api/keys/', '/api/checkout/sessions/'])
		if (path.startsWith(prefix)) return `${prefix}:id`
	return path.startsWith('/api/') ? '/api/:unknown' : '/:not-found'
}
export function safeUrl(value: string) {
	try {
		const url = new URL(value)
		return `${url.origin}${safePath(url.pathname)}`
	} catch {
		return ''
	}
}
export function safeError(error: unknown): Error {
	const name =
		error instanceof Error &&
		/^(Error|TypeError|RangeError|ReferenceError|SyntaxError|URIError|EvalError)$/.test(error.name)
			? error.name
			: 'Error'
	const result = new Error('Application error (message redacted)')
	result.name = name
	// Keep source locations for debugging, never messages, arguments or cause objects.
	const frames = error instanceof Error ? (error.stack ?? '').split('\n').slice(1) : []
	result.stack = `${name}: ${result.message}\n${frames
		.flatMap((frame) => {
			const match = frame.match(
				/(?:https?:\/\/[^\s)]+\/)?([\w./-]+\.(?:[cm]?js|tsx?)):(\d+):(\d+)\)?$/,
			)
			return match ? [`    at ${match[1]}:${match[2]}:${match[3]}`] : []
		})
		.slice(0, 30)
		.join('\n')}`
	return result
}

export function scrubExceptionContext(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(scrubExceptionContext)
	if (!value || typeof value !== 'object') return value
	return Object.fromEntries(
		Object.entries(value)
			.filter(
				([key]) =>
					!['pre_context', 'post_context', 'context_line', 'vars', 'source_context'].includes(key),
			)
			.map(([key, entry]) => [key, scrubExceptionContext(entry)]),
	)
}

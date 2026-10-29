import type { StoredFile } from './service'
export function fileHeaders(file: StoredFile) {
	const names = {
		contentType: 'Content-Type',
		contentLanguage: 'Content-Language',
		contentDisposition: 'Content-Disposition',
		contentEncoding: 'Content-Encoding',
		cacheControl: 'Cache-Control',
		cacheExpiry: 'Expires',
	} as const
	const headers = new Headers()
	for (const [key, name] of Object.entries(names)) {
		const value = Reflect.get(file.metadata, key)
		if (typeof value === 'string') headers.set(name, value)
	}
	headers.set('ETag', file.info.etag)
	headers.set('Content-Length', String(file.info.size))
	headers.set('Content-Disposition', `attachment; filename="${file.info.key}"`)
	return Object.fromEntries(headers)
}

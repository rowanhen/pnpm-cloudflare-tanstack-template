import { PostHog } from 'posthog-node'
import { safeError, safePath, scrubExceptionContext } from './privacy'

export interface ServerConfig {
	POSTHOG_KEY?: string
	POSTHOG_HOST?: string
	APP_ENV?: string
}
export interface RequestReport {
	requestId: string
	method: string
	path: string
	status: number
	durationMs: number
	error?: unknown
}
export async function reportRequest(config: ServerConfig, report: RequestReport) {
	if (!config.POSTHOG_KEY || !config.POSTHOG_HOST) return
	// A client per invocation prevents one request from closing another's queue.
	const client = new PostHog(config.POSTHOG_KEY, {
		host: config.POSTHOG_HOST,
		flushAt: 20,
		flushInterval: 0,
		requestTimeout: 3000,
		fetchRetryCount: 0,
		disableGeoip: true,
		// The SDK logs transport failures during shutdown. Remove provider bodies
		// and network error causes before they can reach those logs.
		fetch: async (url, options) => {
			try {
				const response = await fetch(url, options)
				if (response.ok) return response
				await response.body?.cancel()
				return new Response('Telemetry request failed', { status: response.status })
			} catch {
				throw new Error('Telemetry request unavailable')
			}
		},
		before_send: (event) => {
			if (event?.properties?.$exception_list)
				event.properties.$exception_list = scrubExceptionContext(event.properties.$exception_list)
			return event
		},
	})
	const properties = {
		app: 'api',
		environment: config.APP_ENV ?? 'development',
		request_id: report.requestId,
		route: safePath(report.path),
		method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(report.method)
			? report.method
			: 'OTHER',
		status: report.status,
		duration_ms: Math.max(0, Math.round(report.durationMs)),
		$process_person_profile: false,
	}
	try {
		client.capture({ distinctId: report.requestId, event: 'api.request', properties })
		if (report.error !== undefined)
			client.captureException(safeError(report.error), report.requestId, properties)
		await client.shutdown(4000)
	} catch {
		// An analytics outage must never fail a request or leak a provider response/token.
		console.warn(JSON.stringify({ event: 'telemetry.unavailable', app: 'api' }))
	}
}

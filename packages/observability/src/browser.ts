import type { PostHog, PostHogConfig } from 'posthog-js'
import { safeError, safePath, safeUrl, scrubExceptionContext } from './privacy'

import {
	consentKey,
	createConsent,
	parseConsent,
	type Consent,
	type ConsentPreferences,
} from './consent'
export { consentKey } from './consent'
export type { Consent, ConsentPreferences } from './consent'
export interface BrowserConfig {
	key?: string
	host?: string
	app: 'marketing' | 'dashboard'
	privacyUrl: string
	environment: string
}
export interface Events {
	'template.opened': Record<string, never>
	'waitlist.joined': Record<string, never>
	'api.request.failed': { route: string; status: number; request_id?: string }
}
let sessionConsent: Consent | null = null
let client: PostHog | undefined
let allowed = false
let pending: Promise<void> | undefined
let userId: string | undefined
let lastPage: string | undefined
let contextProperties: { app: BrowserConfig['app']; environment: string } | undefined
const queuedErrors: { error: Error; source: 'route' | 'unhandled' | 'promise' }[] = []
export function hasGlobalPrivacyControl() {
	return (
		typeof navigator !== 'undefined' &&
		(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
	)
}
export function readConsent(): Consent | null {
	try {
		return parseConsent(localStorage.getItem(consentKey))
	} catch {
		return sessionConsent ? parseConsent(JSON.stringify(sessionConsent)) : null
	}
}
export function saveConsent(preferences: ConsentPreferences, source: Consent['source'] = 'user') {
	const signal = hasGlobalPrivacyControl()
	const record = createConsent(
		signal ? { analytics: false, replay: false } : preferences,
		Date.now(),
		signal ? 'gpc' : source,
	)
	sessionConsent = record
	try {
		localStorage.setItem(consentKey, JSON.stringify(record))
	} catch {
		/* Session-only if storage is blocked. */
	}
	return record
}
function permitted(purpose: keyof ConsentPreferences) {
	return !hasGlobalPrivacyControl() && readConsent()?.[purpose] === true
}
export function track<K extends keyof Events>(event: K, properties: Events[K]) {
	if (allowed && permitted('analytics')) client?.capture(event, properties)
}
export function reportError(error: unknown, source: 'route' | 'unhandled' | 'promise') {
	if (!permitted('analytics')) return
	const sanitized = safeError(error)
	if (allowed && client) client.captureException(sanitized, { source })
	else if (queuedErrors.length < 5) queuedErrors.push({ error: sanitized, source })
}
export function identifyUser(id?: string) {
	userId = id
	if (allowed && id && permitted('analytics')) client?.identify(id)
}
export function resetUser() {
	userId = undefined
	if (allowed) {
		client?.reset(true)
		// SDK reset clears its consent too; restore only the still-valid app choices.
		applyPreferences()
	}
}
export function pageView(pathname?: string) {
	if (!allowed || !client || !permitted('analytics')) return
	const path = safePath(pathname ?? window.location.pathname)
	if (path === lastPage) return
	lastPage = path
	client.capture('$pageview', { $current_url: safeUrl(window.location.href), $pathname: path })
}
// SDK-generated attribution can contain arbitrary query values. Keep only explicit
// application events and the SDK fields needed for sessions, replays and exceptions.
export const scrubEvent: PostHogConfig['before_send'] = (event) => {
	if (
		!event ||
		!allowed ||
		!permitted(event.event === '$snapshot' ? 'replay' : 'analytics') ||
		event.event === '$set'
	)
		return null
	delete event.$set
	delete event.$set_once
	if (event.properties.$exception_list)
		event.properties.$exception_list = scrubExceptionContext(event.properties.$exception_list)
	for (const key of Object.keys(event.properties)) {
		if (/url|referrer/i.test(key) && typeof event.properties[key] === 'string')
			event.properties[key] = safeUrl(event.properties[key])
		if (
			/^\$?(initial_|latest_)?(utm_|gclid|fbclid|msclkid)|^\$(set|set_once|initial_person_info)|^\$exception_personURL/.test(
				key,
			)
		)
			delete event.properties[key]
	}
	for (const key of Object.keys(event.properties)) {
		if (key.endsWith('pathname') && typeof event.properties[key] === 'string')
			event.properties[key] = safePath(event.properties[key])
	}
	if (event.event !== '$snapshot')
		event.properties.$process_person_profile = event.properties.$is_identified === true
	return event
}
function applyPreferences() {
	if (!client) return
	if (!permitted('analytics') && !permitted('replay')) {
		stopAnalytics()
		return
	}
	if (!permitted('analytics')) {
		lastPage = undefined
		queuedErrors.length = 0
		client.reset(true)
	}
	// Reset before opting in: this SDK resets consent to its opted-out default.
	client.opt_in_capturing({ captureEventName: false })
	if (contextProperties) client.register(contextProperties)
	if (permitted('analytics') && userId) client.identify(userId)
	if (permitted('replay')) client.startSessionRecording()
	else client.stopSessionRecording()
	pageView()
}
export async function startAnalytics(config: BrowserConfig) {
	const { key, host } = config
	if (!key || !host || typeof window === 'undefined') return
	if (!permitted('analytics') && !permitted('replay')) {
		stopAnalytics()
		return
	}
	allowed = true
	contextProperties = { app: config.app, environment: config.environment }
	if (client) {
		applyPreferences()
		return
	}
	pending ??= (async () => {
		// Bundle the recorder locally; do not execute remotely loaded SDK extensions.
		const { default: posthog } = await import('posthog-js/full/no-external')
		if (!allowed) return
		client = posthog.init(key, {
			api_host: host,
			defaults: '2026-08-30',
			persistence: 'localStorage',
			opt_out_capturing_by_default: true,
			opt_out_persistence_by_default: true,
			cross_subdomain_cookie: false,
			disable_session_recording: !permitted('replay'),
			person_profiles: 'identified_only',
			ip: false,
			autocapture: false,
			capture_pageview: false,
			capture_pageleave: true,
			capture_exceptions: false,
			capture_dead_clicks: false,
			rageclick: false,
			capture_heatmaps: false,
			capture_performance: false,
			disable_surveys: true,
			advanced_disable_feature_flags: true,
			enable_recording_console_log: false,
			save_campaign_params: false,
			save_referrer: false,
			before_send: scrubEvent,
			on_request_error: () => {
				/* Analytics must not break the app. */
			},
			session_recording: {
				maskAllInputs: true,
				maskTextSelector: '*',
				maskAllElementAttributes: true,
				blockSelector: '.ph-no-capture, iframe, img, svg, canvas, video, audio',
				recordHeaders: false,
				recordBody: false,
				captureJsonLd: false,
				maskCapturedNetworkRequestFn: (request) => ({ ...request, name: safeUrl(request.name) }),
			},
		})
		if (config.app === 'dashboard' && !userId) client?.reset(true)
		client?.register({ app: config.app, environment: config.environment })
		applyPreferences()
		for (const entry of queuedErrors.splice(0))
			if (permitted('analytics')) client?.captureException(entry.error, { source: entry.source })
		window.addEventListener('error', (event) => reportError(event.error, 'unhandled'))
		window.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'promise'))
	})()
		.catch(() => {
			/* Blocked SDKs must not affect the application. */
		})
		.finally(() => {
			pending = undefined
		})
	await pending
}
export function stopAnalytics() {
	allowed = false
	lastPage = undefined
	queuedErrors.length = 0
	client?.opt_out_capturing()
	client?.stopSessionRecording()
}
export async function observedFetch(path: string, init?: RequestInit) {
	try {
		const response = await fetch(path, init)
		if (!response.ok) {
			const requestId = response.headers.get('x-request-id')
			track('api.request.failed', {
				route: safePath(new URL(path, window.location.origin).pathname),
				status: response.status,
				...(requestId && /^[a-f0-9-]{36}$/.test(requestId) ? { request_id: requestId } : {}),
			})
		}
		return response
	} catch (error) {
		track('api.request.failed', {
			route: safePath(new URL(path, window.location.origin).pathname),
			status: 0,
		})
		throw error
	}
}

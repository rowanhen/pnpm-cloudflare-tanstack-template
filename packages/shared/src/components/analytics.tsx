import { useEffect, useState } from 'react'
import {
	identifyUser,
	pageView,
	readConsent,
	saveConsent,
	startAnalytics,
	stopAnalytics,
	type BrowserConfig,
	type Consent,
} from '@workspace/observability/browser'
import { Button } from './ui/button'

export function Analytics({ config, pathname }: { config: BrowserConfig; pathname: string }) {
	const [consent, setConsent] = useState<Consent | null>(null)
	const [ready, setReady] = useState(false)
	const [open, setOpen] = useState(false)
	useEffect(() => {
		setConsent(readConsent())
		setReady(true)
		const sync = () => setConsent(readConsent())
		window.addEventListener('storage', sync)
		return () => window.removeEventListener('storage', sync)
	}, [])
	useEffect(() => {
		if (!ready) return
		if (consent === 'accepted') void startAnalytics(config)
		else stopAnalytics()
	}, [consent, config, ready])
	useEffect(() => {
		pageView()
	}, [pathname])
	function choose(value: Consent) {
		if (value === 'declined') stopAnalytics()
		saveConsent(value)
		setConsent(value)
		setOpen(false)
	}
	if (!config.key || !config.host || !ready) return null
	return (
		<aside aria-label="Analytics preferences" className="ph-no-capture">
			{consent === null || open ? (
				<div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-xl border bg-surface-default p-5 shadow-lg">
					<p className="mb-4 text-sm">
						Allow analytics and masked session replay to help improve this demo?
					</p>
					<div className="flex flex-wrap items-center gap-3">
						<Button size="sm" onClick={() => choose('accepted')}>
							Allow analytics
						</Button>
						<Button size="sm" variant="outline" onClick={() => choose('declined')}>
							No thanks
						</Button>
						<a className="text-sm underline" href={config.privacyUrl}>
							Privacy
						</a>
					</div>
				</div>
			) : (
				<Button
					className="fixed bottom-3 left-3 z-40 shadow-sm"
					size="sm"
					variant="outline"
					onClick={() => setOpen(true)}
				>
					Analytics preferences
				</Button>
			)}
		</aside>
	)
}

export function useAnalyticsIdentity(userId: string) {
	useEffect(() => {
		identifyUser(userId)
	}, [userId])
}

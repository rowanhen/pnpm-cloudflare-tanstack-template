import { Container, Checkbox, Label, Button, Typography, Stack } from '@leitware/composables'
import { useEffect, useState } from 'react'
import {
	identifyUser,
	pageView,
	readConsent,
	saveConsent,
	startAnalytics,
	stopAnalytics,
	hasGlobalPrivacyControl,
	type BrowserConfig,
	type Consent,
	type ConsentPreferences,
} from '@workspace/observability/browser'

const rejected: ConsentPreferences = { analytics: false, replay: false }
export function Analytics({ config, pathname }: { config: BrowserConfig; pathname: string }) {
	const [consent, setConsent] = useState<Consent | null>(null)
	const [ready, setReady] = useState(false)
	const [open, setOpen] = useState(false)
	const [managing, setManaging] = useState(false)
	const [signal, setSignal] = useState(false)
	const [draft, setDraft] = useState<ConsentPreferences>(rejected)
	useEffect(() => {
		function sync() {
			const gpc = hasGlobalPrivacyControl()
			let current = readConsent()
			if (gpc && (!current || current.analytics || current.replay || current.source !== 'gpc'))
				current = saveConsent(rejected, 'gpc')
			// Stop synchronously on external withdrawal, before a React effect runs.
			if (!current || gpc || (!current.analytics && !current.replay)) stopAnalytics()
			setConsent(current)
			setSignal(gpc)
			setReady(true)
		}
		sync()
		window.addEventListener('storage', sync)
		window.addEventListener('focus', sync)
		window.addEventListener('pageshow', sync)
		document.addEventListener('visibilitychange', sync)
		return () => {
			window.removeEventListener('storage', sync)
			window.removeEventListener('focus', sync)
			window.removeEventListener('pageshow', sync)
			document.removeEventListener('visibilitychange', sync)
		}
	}, [])
	useEffect(() => {
		if (!ready) return
		if (!signal && (consent?.analytics || consent?.replay)) void startAnalytics(config)
		else stopAnalytics()
		if (!consent) return
		// Browser timers are limited to ~24 days. Recheck long-lived choices in chunks.
		const timer = window.setTimeout(
			() => {
				stopAnalytics()
				setConsent(readConsent())
			},
			Math.min(Math.max(consent.expiresAt - Date.now(), 0), 2_147_483_647),
		)
		return () => window.clearTimeout(timer)
	}, [consent, config, ready, signal])
	useEffect(() => {
		pageView(pathname)
	}, [pathname])
	function choose(value: ConsentPreferences) {
		const record = saveConsent(value)
		if (!record.analytics && !record.replay) stopAnalytics()
		setConsent(record)
		setOpen(false)
		setManaging(false)
	}
	function manage() {
		setDraft(signal ? rejected : (consent ?? rejected))
		setManaging(true)
		setOpen(true)
	}
	if (!config.key || !config.host || !ready) return null
	return (
		<aside aria-label="Privacy preferences" className="ph-no-capture">
			<Container maxWidth="md" className="pb-6">
				<Button className="px-0" size="sm" variant="ghost" onClick={manage}>
					Privacy preferences
				</Button>
			</Container>
			{((!consent && !signal) || open) && (
				<div className="pointer-events-none fixed inset-x-0 bottom-4 z-50">
					<Container maxWidth="md">
						<section
							aria-labelledby="privacy-title"
							className="pointer-events-auto max-h-[85svh] space-y-4 overflow-y-auto rounded-lg border bg-surface-default p-5 shadow-sm"
						>
							<Typography as="h2" variant="heading-100" id="privacy-title">
								Privacy preferences
							</Typography>
							<Typography as="p" variant="body-100" className="text-content-secondary">
								Optional usage analytics and session recordings help us improve this site. Choose
								what to allow.
							</Typography>
							{signal && (
								<output>
									<Typography as="span" variant="body-100">
										Global Privacy Control is on. Optional tracking is disabled.
									</Typography>
								</output>
							)}
							{managing && (
								<Stack gap={4} className="border-y py-4">
									<Typography as="p" variant="caption-100" className="text-content-secondary">
										Essential storage keeps sign-in and your preferences working.
									</Typography>
									{(
										[
											['analytics', 'Analytics', 'Page visits, events and error reports.'],
											['replay', 'Session replay', 'Masked recordings of page interactions.'],
										] as const
									).map(([key, label, detail]) => (
										<Stack gap={3} direction="horizontal" align="start" key={key}>
											<Checkbox
												id={`privacy-${key}`}
												checked={draft[key]}
												disabled={signal}
												onCheckedChange={(checked) =>
													setDraft((value) => ({ ...value, [key]: checked === true }))
												}
											/>
											<div>
												<Label htmlFor={`privacy-${key}`}>{label}</Label>
												<Typography
													as="p"
													variant="caption-100"
													className="mt-1 text-content-secondary"
												>
													{detail}
												</Typography>
											</div>
										</Stack>
									))}
								</Stack>
							)}
							<Stack gap={3} direction="horizontal" align="center" wrap>
								<Button size="sm" variant="outline" onClick={() => choose(rejected)}>
									Reject all
								</Button>
								<Button
									size="sm"
									variant="outline"
									disabled={signal}
									onClick={() => choose({ analytics: true, replay: true })}
								>
									Accept all
								</Button>
								{managing ? (
									<Button size="sm" variant="outline" onClick={() => choose(draft)}>
										Save preferences
									</Button>
								) : (
									<Button size="sm" variant="outline" onClick={manage}>
										Manage
									</Button>
								)}
								<Button
									variant="ghost"
									{...{ nativeButton: false }}
									render={<a role="link" aria-label="Privacy" href={config.privacyUrl} />}
								>
									Privacy
								</Button>
							</Stack>
						</section>
					</Container>
				</div>
			)}
		</aside>
	)
}

export function useAnalyticsIdentity(userId: string) {
	useEffect(() => {
		identifyUser(userId)
	}, [userId])
}

import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { seo, site } from '../lib/seo'

export const Route = createFileRoute('/')({ head: () => seo(), component: MarketingHomePage })
function MarketingHomePage() {
	const [ready, setReady] = useState(false)
	const [busy, setBusy] = useState(false)
	const [message, setMessage] = useState('')
	const [error, setError] = useState('')
	useEffect(() => setReady(true), [])
	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: site.name,
		url: site.url,
		description: site.description,
	}
	return (
		<main
			style={{
				fontFamily: 'system-ui, sans-serif',
				color: '#172c29',
				background: '#f4f5ee',
				minHeight: '100vh',
			}}
		>
			<div style={{ maxWidth: 960, padding: '28px 24px 70px', margin: 'auto' }}>
				<nav
					aria-label="Main navigation"
					style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
				>
					<a href="/" style={{ fontWeight: 750, color: 'inherit', textDecoration: 'none' }}>
						{site.name}
					</a>
					<a href={site.dashboard} style={{ color: 'inherit' }}>
						Sign in →
					</a>
				</nav>
				<section style={{ padding: '90px 0 65px', maxWidth: 740 }}>
					<p style={{ textTransform: 'uppercase', letterSpacing: 3, fontSize: 12 }}>
						An idea worth starting
					</p>
					<h1
						style={{
							fontSize: 'clamp(44px, 7vw, 78px)',
							letterSpacing: '-0.05em',
							lineHeight: 1.05,
							margin: '22px 0',
						}}
					>
						From a small idea
						<br />
						to something useful.
					</h1>
					<p style={{ fontSize: 21, lineHeight: 1.6, maxWidth: 580 }}>{site.description}</p>
					<a href="#waitlist" style={{ color: '#126447', fontWeight: 700 }}>
						Get early access ↓
					</a>
				</section>
				<section
					id="waitlist"
					aria-labelledby="waitlist-title"
					style={{
						background: '#fff',
						border: '1px solid #d2dacf',
						borderRadius: 16,
						padding: 32,
						maxWidth: 640,
					}}
				>
					<h2 id="waitlist-title" style={{ marginTop: 0 }}>
						Be first in line.
					</h2>
					<p>Leave your email to join the waitlist. No account needed.</p>
					{message ? (
						<output>{message}</output>
					) : (
						<form
							onSubmit={async (event) => {
								event.preventDefault()
								setBusy(true)
								setError('')
								const form = new FormData(event.currentTarget)
								try {
									const response = await fetch('/api/waitlist', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({
											name: form.get('name'),
											email: form.get('email'),
											website: form.get('website'),
											consent: form.get('consent') === 'on',
										}),
									})
									const data = (await response.json()) as { message?: string; error?: string }
									if (!response.ok)
										throw new Error(data.error ?? 'Something went wrong. Please try again.')
									setMessage(data.message ?? "You're on the list!")
								} catch (cause) {
									setError(cause instanceof Error ? cause.message : 'Unable to join the waitlist.')
								} finally {
									setBusy(false)
								}
							}}
						>
							<label style={{ display: 'block', marginBottom: 16 }}>
								Your name (optional)
								<input
									name="name"
									autoComplete="name"
									maxLength={100}
									style={inputStyle}
									disabled={!ready || busy}
								/>
							</label>
							<label style={{ display: 'block', marginBottom: 16 }}>
								Email address
								<input
									name="email"
									type="email"
									autoComplete="email"
									maxLength={254}
									required
									style={inputStyle}
									disabled={!ready || busy}
								/>
							</label>
							<div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
								<label>
									Website
									<input name="website" tabIndex={-1} autoComplete="off" />
								</label>
							</div>
							<label style={{ display: 'block', lineHeight: 1.6 }}>
								<input name="consent" type="checkbox" required disabled={!ready || busy} /> I agree
								to have my email saved for the waitlist. <a href="/privacy">Privacy details</a>
							</label>
							<button
								type="submit"
								disabled={!ready || busy}
								style={{
									border: 0,
									borderRadius: 8,
									background: '#185c43',
									color: '#fff',
									padding: '14px 24px',
									fontSize: 16,
									marginTop: 24,
								}}
							>
								{busy ? 'Joining…' : 'Join the waitlist'}
							</button>
							{error && (
								<p role="alert" style={{ color: '#a02020' }}>
									{error}
								</p>
							)}
						</form>
					)}
				</section>
				<section aria-labelledby="faq-title" style={{ marginTop: 56, maxWidth: 640 }}>
					<h2 id="faq-title">A few things to know</h2>
					<h3>What happens when I join?</h3>
					<p>
						Your email is saved to the project’s waitlist. This starter does not send emails
						automatically.
					</p>
					<h3>Can I try the workspace?</h3>
					<p>
						Yes. Sign in with Google to try private records, file storage, and an API key for your
						own data.
					</p>
				</section>
				<footer style={{ borderTop: '1px solid #d2dacf', marginTop: 52, paddingTop: 24 }}>
					{site.name} · <a href="/privacy">Privacy</a> · <a href={site.dashboard}>Your workspace</a>
				</footer>
			</div>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
				}}
			/>
		</main>
	)
}
const inputStyle = {
	display: 'block',
	width: '100%',
	boxSizing: 'border-box' as const,
	padding: 12,
	marginTop: 8,
	border: '1px solid #a5b8ac',
	borderRadius: 6,
	fontSize: 16,
}

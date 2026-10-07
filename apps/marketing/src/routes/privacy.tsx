import { createFileRoute } from '@tanstack/react-router'
import { seo, site } from '../lib/seo'
export const Route = createFileRoute('/privacy')({
	head: () =>
		seo('/privacy', `Privacy — ${site.name}`, 'How this example stores waitlist and account data.'),
	component: Privacy,
})
function Privacy() {
	return (
		<main
			style={{
				maxWidth: 720,
				margin: '60px auto',
				padding: 24,
				fontFamily: 'system-ui',
				lineHeight: 1.7,
			}}
		>
			<a href="/">← {site.name}</a>
			<h1>Privacy in this demo</h1>
			<p>
				The waitlist stores the email address and optional name you submit, your consent, and the
				time you joined. It does not send email automatically.
			</p>
			<p>
				Google sign-in stores your name, email address, optional profile image, and the account
				identifiers needed to sign you in. Essential HTTP-only cookies keep you signed in. Your
				private records, files and API key hashes are stored in Cloudflare D1 and R2.
			</p>
			<p>
				This example includes no advertising or analytics trackers. Request counters are used to
				limit abuse.
			</p>
			<p>
				This is example copy for a starter project. Before a public launch, the project owner must
				replace it with their actual contact, retention and deletion information.
			</p>
		</main>
	)
}

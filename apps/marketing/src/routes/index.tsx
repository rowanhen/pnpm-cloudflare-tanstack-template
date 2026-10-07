import { createFileRoute } from '@tanstack/react-router'
import { AppShell, appCopy } from '@workspace/shared'

export const Route = createFileRoute('/')({
	component: MarketingHomePage,
})

function MarketingHomePage() {
	const copy = appCopy('Marketing', 'customer-facing')

	return (
		<AppShell title={copy.title} description={copy.description} accent="#22c55e">
			<div
				style={{
					display: 'grid',
					gap: 16,
					gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
				}}
			>
				<Card
					title="Frontend"
					body="TanStack Start on Cloudflare Pages, with a shared Cloudflare Worker REST API."
				/>
				<Card
					title="Backend"
					body="D1 SQL todo CRUD and R2 file storage, with working REST examples in the dashboard."
				/>
				<Card
					title="Workspace"
					body="pnpm apps + packages layout with shared scripts, linting, and deployment flow."
				/>
			</div>
		</AppShell>
	)
}

function Card(props: { title: string; body: string }) {
	return (
		<div
			style={{
				border: '1px solid rgba(255,255,255,0.16)',
				padding: 20,
				background: 'rgba(15, 23, 42, 0.6)',
			}}
		>
			<h2 style={{ marginTop: 0, fontSize: 18 }}>{props.title}</h2>
			<p style={{ marginBottom: 0, color: '#cbd5e1', lineHeight: 1.6 }}>{props.body}</p>
		</div>
	)
}

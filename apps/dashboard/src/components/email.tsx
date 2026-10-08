import { Alert, Button, Card, Stack } from '@workspace/shared'
import { useEmail } from '../hooks/use-email'

export function Email() {
	const { status, send, disabled } = useEmail()
	return (
		<Card title={<h2>Email</h2>}>
			<Stack gap={3}>
				<div>
					<Button disabled={disabled} onClick={() => send.mutate()}>
						{send.isPending ? 'Sending…' : 'Send me a test'}
					</Button>
				</div>
				{status.data && !status.data.enabled && (
					<p className="text-sm text-content-secondary">Email is not connected.</p>
				)}
				{send.isSuccess && <output>Email accepted for delivery.</output>}
				{(send.error || status.error) && (
					<Alert type="negative">{(send.error ?? status.error)?.message}</Alert>
				)}
				{status.data?.emails.length ? (
					<ul className="text-sm">
						{status.data.emails.map((email) => (
							<li key={email.id} className="flex justify-between border-t py-2">
								<time dateTime={email.created_at}>
									{new Date(email.created_at).toLocaleString()}
								</time>
								<span>{email.status}</span>
							</li>
						))}
					</ul>
				) : null}
			</Stack>
		</Card>
	)
}

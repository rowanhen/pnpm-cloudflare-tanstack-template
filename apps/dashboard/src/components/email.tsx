import { Alert, Button, PageSection, Stack, Typography } from '@workspace/shared'

import { useEmail } from '../hooks/use-email'

export function Email() {
	const { status, send, disabled } = useEmail()
	return (
		<PageSection title="Email">
			<Stack gap={3}>
				<div>
					<Button disabled={disabled} onClick={() => send.mutate()}>
						{send.isPending ? 'Sending…' : 'Send me a test'}
					</Button>
				</div>
				{status.data && !status.data.enabled && (
					<Typography as="p" variant="body-100" className="text-content-secondary">
						Email is not connected.
					</Typography>
				)}
				{send.isSuccess && (
					<output>
						<Typography as="span" variant="body-100">
							Email accepted for delivery.
						</Typography>
					</output>
				)}
				{(send.error || status.error) && (
					<Alert type="negative">{(send.error ?? status.error)?.message}</Alert>
				)}
				{status.data?.emails.length ? (
					<ul>
						{status.data.emails.map((email) => (
							<li key={email.id} className="flex justify-between border-t py-2">
								<time dateTime={email.created_at}>
									<Typography as="span" variant="caption-100">
										{new Date(email.created_at).toLocaleString()}
									</Typography>
								</time>
								<Typography as="span" variant="body-200">
									{email.status}
								</Typography>
							</li>
						))}
					</ul>
				) : null}
			</Stack>
		</PageSection>
	)
}

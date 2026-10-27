import { Button, Card, Input, Label, Checkbox, Alert, Stack, Typography } from '@workspace/shared'
import { useWaitlist } from '../hooks/use-waitlist'

export function WaitlistForm({ title }: { title: string }) {
	const { disabled, busy, error, submit } = useWaitlist()
	return (
		<Card
			id="waitlist"
			className="shadow-none"
			title={
				<Typography as="h2" variant="heading-400" id="waitlist-title">
					{title}
				</Typography>
			}
			aria-labelledby="waitlist-title"
		>
			<form
				className="space-y-5"
				onSubmit={(event) => {
					event.preventDefault()
					void submit(event.currentTarget)
				}}
			>
				<Stack gap={2}>
					<Label htmlFor="name">Name (optional)</Label>
					<Input id="name" name="name" autoComplete="name" maxLength={100} disabled={disabled} />
				</Stack>
				<Stack gap={2}>
					<Label htmlFor="email">Email address</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						maxLength={254}
						required
						disabled={disabled}
					/>
				</Stack>
				<div aria-hidden="true" className="absolute -left-[10000px]">
					<Label>
						Website
						<Input name="website" tabIndex={-1} autoComplete="off" />
					</Label>
				</div>
				<Stack direction="horizontal" align="start" gap={3}>
					<Checkbox id="consent" name="consent" required disabled={disabled} />
					<Label htmlFor="consent" className="block text-content-secondary">
						<Typography as="span" variant="caption-100">
							Save my email in this demo.
						</Typography>{' '}
					</Label>
				</Stack>
				<Button type="submit" disabled={disabled} className="w-full" size="lg">
					{busy ? 'Joining…' : 'Join the waitlist'}
				</Button>
				{error && <Alert type="negative" message={error} />}
			</form>
		</Card>
	)
}

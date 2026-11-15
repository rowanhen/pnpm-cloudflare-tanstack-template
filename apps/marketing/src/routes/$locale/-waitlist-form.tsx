import {
	Button,
	Card,
	Input,
	Label,
	Checkbox,
	Alert,
	Stack,
	Typography,
} from '@leitware/composables'
import { useHydrated } from '@workspace/shared'
import { useNavigate, useParams } from '@tanstack/react-router'
import { track } from '@workspace/observability/browser'
import { useState } from 'react'
import { useJoinWaitlist } from '../../generated/waitlist'

export function WaitlistForm({ title }: { title: string }) {
	const hydrated = useHydrated()
	const navigate = useNavigate()
	const { locale } = useParams({ from: '/$locale' })
	const [validationError, setValidationError] = useState('')
	const mutation = useJoinWaitlist({
		mutation: {
			onSuccess: async () => {
				track('waitlist.joined', {})
				await navigate({ to: '/$locale/waitlist/success', params: { locale } })
			},
		},
	})
	const disabled = !hydrated || mutation.isPending
	const error = validationError || mutation.error?.message
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
					setValidationError('')
					const fields = new FormData(event.currentTarget)
					const consent = fields.get('consent') === 'on'
					if (!consent) {
						setValidationError('Please agree to join the waitlist')
						return
					}
					mutation.mutate({
						data: {
							name: fields.get('name')?.toString() ?? '',
							email: fields.get('email')?.toString() ?? '',
							website: fields.get('website')?.toString() ?? '',
							consent,
						},
					})
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
					{mutation.isPending ? 'Joining…' : 'Join the waitlist'}
				</Button>
				{error && <Alert type="negative" message={error} />}
			</form>
		</Card>
	)
}

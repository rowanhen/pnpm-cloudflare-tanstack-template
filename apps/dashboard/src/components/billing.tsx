import { Alert, Badge, Button, Card, Skeleton, Stack, Typography } from '@workspace/shared'
import { useBilling } from '../hooks/use-billing'

export function Billing() {
	const billing = useBilling()
	return (
		<Card title={<h2>API credits</h2>} action={<Badge variant="outline">Test mode</Badge>}>
			<Stack gap={4}>
				{billing.isPending ? (
					<Skeleton className="h-10 w-40" aria-label="Loading credits" />
				) : (
					billing.data && (
						<div className="flex flex-wrap items-baseline gap-3">
							<Typography variant="heading-400" aria-live="polite" data-testid="credit-balance">
								{billing.data.balance.toLocaleString('en-GB')}{' '}
								{billing.data.balance === 1 ? 'credit' : 'credits'}
							</Typography>
							<span className="text-sm text-content-secondary">
								{billing.data.summaryCost} credit / summary
							</span>
						</div>
					)
				)}
				{billing.error && <Alert type="negative">{billing.error.message}</Alert>}
				<Stack direction="horizontal" gap={3} wrap>
					<Button asChild>
						<a href="/checkout">Add credits</a>
					</Button>
					<Button
						variant="outline"
						disabled={billing.isFetching}
						onClick={() => void billing.refetch()}
					>
						Refresh balance
					</Button>
				</Stack>
			</Stack>
		</Card>
	)
}

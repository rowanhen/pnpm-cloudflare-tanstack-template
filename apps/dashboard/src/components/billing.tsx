import { Link } from '@tanstack/react-router'
import { Alert, Button, PageSection, Skeleton, Stack, Typography } from '@workspace/shared'

import { useBilling } from '../hooks/use-billing'

export function Billing() {
	const billing = useBilling()
	return (
		<PageSection title="API credits">
			<Stack gap={4}>
				{billing.isPending ? (
					<Skeleton className="h-10 w-40" aria-label="Loading credits" />
				) : (
					billing.data && (
						<Stack gap={3} direction="horizontal" align="baseline" wrap>
							<Typography variant="heading-400" aria-live="polite" data-testid="credit-balance">
								{billing.data.balance.toLocaleString('en-GB')}{' '}
								{billing.data.balance === 1 ? 'credit' : 'credits'}
							</Typography>
							<Typography as="span" variant="body-100" className="text-content-secondary">
								{billing.data.summaryCost} credit / summary
							</Typography>
						</Stack>
					)
				)}
				{billing.error && <Alert type="negative">{billing.error.message}</Alert>}
				<Stack direction="horizontal" gap={3} wrap>
					<Button
						{...{ nativeButton: false }}
						render={<Link aria-label="Add credits" role="link" to="/checkout" />}
					>
						Add credits
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
		</PageSection>
	)
}

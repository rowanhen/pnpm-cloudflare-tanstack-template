import { Alert, Button, Skeleton, Typography } from '@leitware/composables'
import { LinkButton, PageSection } from '@workspace/shared'

import { useBilling } from '../hooks/use-billing'

export function Billing() {
	const billing = useBilling()
	return (
		<PageSection title="API credits">
			<div className="flex min-w-0 flex-col gap-4">
				{billing.isPending ? (
					<Skeleton className="h-10 w-40" aria-label="Loading credits" />
				) : (
					billing.data && (
						<div className="flex min-w-0 items-baseline flex-wrap gap-3">
							<Typography variant="heading-400" aria-live="polite" data-testid="credit-balance">
								{billing.data.balance.toLocaleString('en-GB')}{' '}
								{billing.data.balance === 1 ? 'credit' : 'credits'}
							</Typography>
							<Typography as="span" variant="body-100" className="text-content-secondary">
								{billing.data.summaryCost} credit / summary
							</Typography>
						</div>
					)
				)}
				{billing.error && <Alert type="negative">{billing.error.message}</Alert>}
				<div className="flex min-w-0 flex-wrap gap-3">
					<LinkButton variant="primary" aria-label="Add credits" to="/credits">
						Add credits
					</LinkButton>
					<Button
						variant="default"
						disabled={billing.isFetching}
						onClick={() => void billing.refetch()}
					>
						Refresh balance
					</Button>
				</div>
			</div>
		</PageSection>
	)
}

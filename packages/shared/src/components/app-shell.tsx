import { LinkButton } from './link-button'
import { Typography } from '@leitware/composables'

import type { ReactNode } from 'react'

import { APP_NAME } from '../project'

export function AppShell({
	title,
	description,
	children,
	actions,
}: {
	title: string
	description?: string
	children: ReactNode
	actions?: ReactNode
}) {
	return (
		<div className="min-h-svh">
			<div className="page-container">
				<header className="flex flex-wrap items-center justify-between gap-4 border-b py-6">
					<LinkButton variant="ghost" aria-label={APP_NAME} to="/">
						{APP_NAME}
					</LinkButton>
					{actions && (
						<nav aria-label="Workspace navigation" className="flex items-center gap-3">
							{actions}
						</nav>
					)}
				</header>
				<main className="py-12 sm:py-16">
					<div className="flex min-w-0 flex-col gap-10">
						<div className="flex min-w-0 flex-col gap-3">
							<Typography as="h1" variant="heading-500">
								{title}
							</Typography>
							{description && (
								<Typography as="p" variant="body-100" className="text-content-secondary">
									{description}
								</Typography>
							)}
						</div>
						{children}
					</div>
				</main>
			</div>
		</div>
	)
}

export function PageSection({
	title,
	description,
	children,
}: {
	title: string
	description?: string
	children: ReactNode
}) {
	return (
		<section className="py-6 border-t">
			<div className="flex min-w-0 flex-col gap-5">
				<div className="flex min-w-0 flex-col gap-2">
					<Typography as="h2" variant="heading-400">
						{title}
					</Typography>
					{description && (
						<Typography as="p" variant="body-100" className="text-content-secondary">
							{description}
						</Typography>
					)}
				</div>
				{children}
			</div>
		</section>
	)
}

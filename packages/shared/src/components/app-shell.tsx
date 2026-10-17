import { Button, Container, Typography, Stack, Section } from '@leitware/composables'
import { Link } from '@tanstack/react-router'

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
			<Container maxWidth="md">
				<header className="flex flex-wrap items-center justify-between gap-4 border-b py-6">
					<Button
						variant="ghost"
						{...{ nativeButton: false }}
						render={<Link aria-label={APP_NAME} role="link" to="/" />}
					>
						{APP_NAME}
					</Button>
					{actions && (
						<nav aria-label="Workspace navigation" className="flex items-center gap-3">
							{actions}
						</nav>
					)}
				</header>
				<main className="py-12 sm:py-16">
					<Stack gap={10}>
						<Stack gap={3}>
							<Typography as="h1" variant="heading-500">
								{title}
							</Typography>
							{description && (
								<Typography as="p" variant="body-100" className="text-content-secondary">
									{description}
								</Typography>
							)}
						</Stack>
						{children}
					</Stack>
				</main>
			</Container>
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
		<Section spacing="sm" className="border-t">
			<Stack gap={5}>
				<Stack gap={2}>
					<Typography as="h2" variant="heading-400">
						{title}
					</Typography>
					{description && (
						<Typography as="p" variant="body-100" className="text-content-secondary">
							{description}
						</Typography>
					)}
				</Stack>
				{children}
			</Stack>
		</Section>
	)
}

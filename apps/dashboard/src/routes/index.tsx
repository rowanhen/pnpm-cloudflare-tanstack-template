import {
	AppShell,
	Button,
	PageSection,
	Stack,
	Input,
	Label,
	Checkbox,
	Alert,
	Skeleton,
	useHydrated,
	Typography,
} from '@workspace/shared'
import { useAnalyticsIdentity } from '@workspace/shared/components/analytics'
import { Email } from '../components/email'
import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { getSession } from '../lib/session'
import { api } from '../lib/api'
import { ApiKeys } from '../lib/api-keys'
import { Billing } from '../components/billing'
import { useSignOut, useWorkspace } from '../hooks/use-workspace'

export const Route = createFileRoute('/')({
	beforeLoad: async () => {
		const user = await getSession()
		if (!user) throw redirect({ to: '/login' })
		return { user }
	},
	component: DashboardHomePage,
})
function DashboardHomePage() {
	const { user } = Route.useRouteContext()
	useAnalyticsIdentity(user.id)
	const [title, setTitle] = useState('')
	const [file, setFile] = useState<File | null>(null)
	const { todos, files, mutation, todoMutations, busy, error } = useWorkspace(user.id)
	const hydrated = useHydrated()
	const signOut = useSignOut()
	return (
		<AppShell
			title="Your workspace"
			description={user.email}
			actions={
				<Button
					disabled={!hydrated || signOut.isPending}
					variant="outline"
					size="sm"
					onClick={() => signOut.mutate()}
				>
					Sign out
				</Button>
			}
		>
			{(error || signOut.error) && (
				<Alert type="negative">{(error ?? signOut.error)?.message}</Alert>
			)}
			<Stack gap={10}>
				<PageSection title="Todos">
					<Stack gap={6}>
						<form
							className="flex items-end gap-3"
							onSubmit={(event) => {
								event.preventDefault()
								todoMutations.create.mutate({ data: { title } }, { onSuccess: () => setTitle('') })
							}}
						>
							<Stack gap={2} className="min-w-0 flex-1">
								<Label htmlFor="todo-title" className="sr-only">
									Todo title
								</Label>
								<Input
									id="todo-title"
									disabled={busy}
									value={title}
									onChange={(event) => setTitle(event.target.value)}
									required
									maxLength={200}
									placeholder="New todo"
								/>
							</Stack>
							<Button disabled={busy} type="submit">
								Add todo
							</Button>
						</form>
						{todos.isPending && <Skeleton className="h-14 w-full" aria-label="Loading todos" />}
						<ul className="divide-y">
							{todos.data?.todos.map((item) => (
								<li key={item.id} className="flex items-center justify-between gap-3 py-3">
									<Stack gap={3} direction="horizontal" align="center" className="min-w-0">
										<Checkbox
											id={`todo-${item.id}`}
											checked={item.completed}
											disabled={busy}
											onCheckedChange={() =>
												todoMutations.update.mutate({
													id: item.id,
													data: { completed: !item.completed },
												})
											}
										/>
										<Label
											htmlFor={`todo-${item.id}`}
											className={`break-all ${item.completed ? 'text-content-secondary line-through' : ''}`}
										>
											{item.title}
										</Label>
									</Stack>
									<Button
										variant="ghost"
										size="sm"
										disabled={busy}
										onClick={() => todoMutations.delete.mutate({ id: item.id })}
										aria-label={`Delete todo ${item.title}`}
									>
										Delete
									</Button>
								</li>
							))}
						</ul>
						{todos.data?.todos.length === 0 && (
							<Typography as="p" variant="body-100" className="text-content-secondary">
								No todos yet.
							</Typography>
						)}
					</Stack>
				</PageSection>
				<PageSection title="Files" description="Up to 5 MiB per file.">
					<Stack gap={6}>
						<form
							className="space-y-3"
							onSubmit={(event) => {
								event.preventDefault()
								if (file)
									mutation.mutate(() =>
										api(`/api/files/${encodeURIComponent(file.name)}`, {
											method: 'PUT',
											headers: { 'Content-Type': file.type || 'application/octet-stream' },
											body: file,
										}),
									)
							}}
						>
							<Stack gap={2}>
								<Label htmlFor="file">File</Label>
								<Input
									id="file"
									type="file"
									required
									disabled={busy}
									onChange={(event) => setFile(event.target.files?.[0] ?? null)}
								/>
								<Typography as="p" variant="caption-100" className="text-content-secondary">
									Filenames: letters, numbers, . _ - only. Matching names replace existing files.
								</Typography>
							</Stack>
							<Button disabled={busy || !file} type="submit" variant="secondary">
								Upload file
							</Button>
						</form>
						{files.isPending && <Skeleton className="h-14 w-full" aria-label="Loading files" />}
						<ul className="divide-y">
							{files.data?.files.map((item) => (
								<li
									key={item.key}
									className="flex flex-wrap items-center justify-between gap-2 py-3"
								>
									<div className="min-w-0">
										<Typography as="p" variant="body-100" className="break-all">
											{item.key}
										</Typography>
										<Typography as="p" variant="caption-100" className="text-content-secondary">
											{item.size} bytes
										</Typography>
									</div>
									<Stack gap={1} direction="horizontal">
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												mutation.mutate(async () => {
													const response = await api(`/api/files/${encodeURIComponent(item.key)}`)
													const url = URL.createObjectURL(await response.blob())
													const anchor = document.createElement('a')
													anchor.href = url
													anchor.download = item.key
													anchor.click()
													setTimeout(() => URL.revokeObjectURL(url), 1000)
												})
											}
											disabled={busy}
											aria-label={`Download ${item.key}`}
										>
											Download
										</Button>
										<Button
											variant="ghost"
											size="sm"
											disabled={busy}
											onClick={() =>
												mutation.mutate(() =>
													api(`/api/files/${encodeURIComponent(item.key)}`, { method: 'DELETE' }),
												)
											}
											aria-label={`Delete file ${item.key}`}
										>
											Delete
										</Button>
									</Stack>
								</li>
							))}
						</ul>
						{files.data?.files.length === 0 && (
							<Typography as="p" variant="body-100" className="text-content-secondary">
								No files yet.
							</Typography>
						)}
						{files.data?.cursor && (
							<Typography as="p" variant="body-100" className="text-content-secondary">
								Showing the first 100 files.
							</Typography>
						)}
					</Stack>
				</PageSection>
			</Stack>
			<Billing />
			<ApiKeys />
			<Email />
		</AppShell>
	)
}

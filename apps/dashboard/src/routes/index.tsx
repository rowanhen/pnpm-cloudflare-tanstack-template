import {
	Button,
	Empty,
	Input,
	DropZone,
	Label,
	Checkbox,
	Alert,
	Skeleton,
	Typography,
} from '@leitware/composables'
import { AppShell, PageSection, useHydrated } from '@workspace/shared'
import { useAnalyticsIdentity } from '@workspace/shared/components/analytics'
import { Email } from '../components/email'
import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { getSession } from '../lib/session'
import { uploadFile, downloadFile, deleteFile } from '../generated/files'
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
	const [fileError, setFileError] = useState('')
	const { todos, files, mutation, todoMutations, busy, error } = useWorkspace(user.id)
	const replacingFile = !!file && !!files.data?.files.some((item) => item.key === file.name)
	const hydrated = useHydrated()
	const signOut = useSignOut()
	return (
		<AppShell
			title="Your workspace"
			description={user.email}
			actions={
				<Button
					disabled={!hydrated || signOut.isPending}
					variant="default"
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
			<div className="flex min-w-0 flex-col gap-10">
				<PageSection title="Todos">
					<div className="flex min-w-0 flex-col gap-6">
						<form
							className="flex items-end gap-3"
							onSubmit={(event) => {
								event.preventDefault()
								todoMutations.create.mutate({ data: { title } }, { onSuccess: () => setTitle('') })
							}}
						>
							<div className="flex min-w-0 flex-col gap-2 flex-1">
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
							</div>
							<Button variant="primary" disabled={busy} type="submit">
								Add todo
							</Button>
						</form>
						{todos.isPending && <Skeleton className="h-14 w-full" aria-label="Loading todos" />}
						<ul className="divide-y">
							{todos.data?.todos.map((item) => (
								<li key={item.id} className="flex items-center justify-between gap-3 py-3">
									<div className="flex min-w-0 items-center gap-3">
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
									</div>
									<Button
										variant="destructive"
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
						{todos.data?.todos.length === 0 && <Empty title="No todos yet." />}
					</div>
				</PageSection>
				<PageSection title="Files" description="Up to 5 MiB per file.">
					<div className="flex min-w-0 flex-col gap-6">
						<form
							className="space-y-3"
							onSubmit={(event) => {
								event.preventDefault()
								if (file)
									mutation.mutate(
										() =>
											uploadFile(file.name, file, {
												headers: { 'Content-Type': file.type || 'application/octet-stream' },
											}),
										{ onSuccess: () => setFile(null) },
									)
							}}
						>
							<div className="flex min-w-0 flex-col gap-2">
								<DropZone
									prompt="Upload a file"
									value={file ? [file] : []}
									maxSize={5 * 1024 * 1024}
									disabled={busy}
									validate={(candidate) =>
										/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(candidate.name)
											? null
											: 'Use a 1–200 character filename with letters, numbers, dots, underscores or hyphens.'
									}
									onValueChange={(accepted) => {
										setFile(accepted[0] ?? null)
										setFileError('')
									}}
									onReject={([rejected]) => {
										setFile(null)
										const reason = rejected?.reasons[0]
										setFileError(
											reason === 'file-too-large'
												? 'Files must be 5 MiB or smaller.'
												: reason === 'too-many-files'
													? 'Choose one file at a time.'
													: (reason ?? 'File rejected.'),
										)
									}}
								/>
								{fileError && <Alert type="negative">{fileError}</Alert>}
								<Typography as="p" variant="caption-100" className="text-content-secondary">
									Filenames: letters, numbers, . _ - only. Matching names replace existing files.
								</Typography>
							</div>
							<Button
								disabled={busy || !file}
								type="submit"
								variant={replacingFile ? 'destructive' : 'default'}
							>
								{replacingFile ? 'Replace file' : 'Upload file'}
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
									<div className="flex min-w-0 gap-1">
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												mutation.mutate(async () => {
													const response = await downloadFile(item.key)
													const url = URL.createObjectURL(response.data)
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
											variant="destructive"
											size="sm"
											disabled={busy}
											onClick={() => mutation.mutate(() => deleteFile(item.key))}
											aria-label={`Delete file ${item.key}`}
										>
											Delete
										</Button>
									</div>
								</li>
							))}
						</ul>
						{files.data?.files.length === 0 && <Empty title="No files yet." />}
						{files.data?.cursor && (
							<Typography as="p" variant="body-100" className="text-content-secondary">
								Showing the first 100 files.
							</Typography>
						)}
					</div>
				</PageSection>
			</div>
			<Billing />
			<ApiKeys />
			<Email />
		</AppShell>
	)
}

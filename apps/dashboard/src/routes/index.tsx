import { Email } from '../components/email'
import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
	AppShell,
	Button,
	Card,
	Stack,
	Input,
	Label,
	Checkbox,
	Alert,
	Skeleton,
	useHydrated,
} from '@workspace/shared'
import { getSession } from '../lib/session'
import { api, client } from '../lib/api'
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
	const [title, setTitle] = useState('')
	const [file, setFile] = useState<File | null>(null)
	const { todos, files, mutation, busy, error } = useWorkspace(user.id)
	const hydrated = useHydrated()
	const signOut = useSignOut()
	return (
		<AppShell
			title="Your workspace"
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
			<p className="text-sm text-content-secondary">{user.email}</p>
			{(error || signOut.error) && (
				<Alert type="negative">{(error ?? signOut.error)?.message}</Alert>
			)}
			<div className="grid items-start gap-6 lg:grid-cols-2">
				<Card title={<h2>Todos</h2>}>
					<Stack gap={6}>
						<form
							className="flex items-end gap-3"
							onSubmit={(event) => {
								event.preventDefault()
								mutation.mutate(async () => {
									await client.mutate('createTodo', { title })
									setTitle('')
								})
							}}
						>
							<div className="flex-1 space-y-2">
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
							<Button disabled={busy} type="submit">
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
												mutation.mutate(() =>
													client.updateTodo(item.id, { completed: !item.completed }),
												)
											}
										/>
										<Label
											htmlFor={`todo-${item.id}`}
											className={`break-all leading-5 ${item.completed ? 'text-content-secondary line-through' : ''}`}
										>
											{item.title}
										</Label>
									</div>
									<Button
										variant="ghost"
										size="sm"
										disabled={busy}
										onClick={() => mutation.mutate(() => client.deleteTodo(item.id))}
										aria-label={`Delete todo ${item.title}`}
									>
										Delete
									</Button>
								</li>
							))}
						</ul>
						{todos.data?.todos.length === 0 && (
							<p className="rounded-lg border border-dashed p-6 text-center text-sm text-content-secondary">
								No todos yet.
							</p>
						)}
					</Stack>
				</Card>
				<Card title={<h2>Files</h2>} description="Up to 5 MiB per file.">
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
							<div className="space-y-2">
								<Label htmlFor="file">File</Label>
								<Input
									id="file"
									type="file"
									required
									disabled={busy}
									onChange={(event) => setFile(event.target.files?.[0] ?? null)}
								/>
								<p className="text-xs text-content-secondary">
									Filenames: letters, numbers, . _ - only. Matching names replace existing files.
								</p>
							</div>
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
										<p className="break-all text-sm font-medium">{item.key}</p>
										<p className="text-xs text-content-secondary">{item.size} bytes</p>
									</div>
									<div className="flex gap-1">
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
									</div>
								</li>
							))}
						</ul>
						{files.data?.files.length === 0 && (
							<p className="rounded-lg border border-dashed p-6 text-center text-sm text-content-secondary">
								No files yet.
							</p>
						)}
						{files.data?.cursor && (
							<p className="text-sm text-content-secondary">Showing the first 100 files.</p>
						)}
					</Stack>
				</Card>
			</div>
			<Billing />
			<ApiKeys />
			<Email />
		</AppShell>
	)
}

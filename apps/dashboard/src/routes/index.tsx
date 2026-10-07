import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
	AppShell,
	Button,
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Input,
	Label,
	Checkbox,
	Alert,
	AlertDescription,
	Badge,
	Skeleton,
	useHydrated,
} from '@workspace/shared'
import { getSession } from '../lib/session'
import { api } from '../lib/api'
import { ApiKeys } from '../lib/api-keys'
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
			description="A home for your ideas, files, and the little things that make them work."
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
			<div className="flex flex-wrap items-center gap-3">
				<Badge variant="outline">Private workspace</Badge>
				<p className="text-sm text-muted-foreground">
					Signed in as <strong className="text-foreground">{user.email}</strong>
				</p>
			</div>
			{(error || signOut.error) && (
				<Alert variant="destructive">
					<AlertDescription>{(error ?? signOut.error)?.message}</AlertDescription>
				</Alert>
			)}
			<div className="grid items-start gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>
							<h2>D1 todos</h2>
						</CardTitle>
						<CardDescription>Your own small list. Saved across devices.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<form
							className="flex items-end gap-3"
							onSubmit={(event) => {
								event.preventDefault()
								mutation.mutate(async () => {
									await api('/api/todos', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({ title }),
									})
									setTitle('')
								})
							}}
						>
							<div className="flex-1 space-y-2">
								<Label htmlFor="todo-title">Todo title</Label>
								<Input
									id="todo-title"
									disabled={busy}
									value={title}
									onChange={(event) => setTitle(event.target.value)}
									required
									maxLength={200}
									placeholder="What are you working on?"
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
													api(`/api/todos/${item.id}`, {
														method: 'PATCH',
														headers: { 'Content-Type': 'application/json' },
														body: JSON.stringify({ completed: !item.completed }),
													}),
												)
											}
										/>
										<Label
											htmlFor={`todo-${item.id}`}
											className={`break-all leading-5 ${item.completed ? 'text-muted-foreground line-through' : ''}`}
										>
											{item.title}
										</Label>
									</div>
									<Button
										variant="ghost"
										size="sm"
										disabled={busy}
										onClick={() =>
											mutation.mutate(() => api(`/api/todos/${item.id}`, { method: 'DELETE' }))
										}
										aria-label={`Delete todo ${item.title}`}
									>
										Delete
									</Button>
								</li>
							))}
						</ul>
						{todos.data?.todos.length === 0 && (
							<p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
								No todos yet. A good idea starts with one small step.
							</p>
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>
							<h2>R2 files</h2>
						</CardTitle>
						<CardDescription>Private file storage. Up to 5 MiB per file.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
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
								<p className="text-xs text-muted-foreground">
									Letters, numbers, dots, underscores and hyphens. The same filename replaces the
									existing file.
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
										<p className="text-xs text-muted-foreground">{item.size} bytes</p>
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
							<p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
								No files yet. Give your ideas a place to live.
							</p>
						)}
						{files.data?.cursor && (
							<p className="text-sm text-muted-foreground">
								Showing the first 100 files. Use the REST API cursor to fetch more.
							</p>
						)}
					</CardContent>
				</Card>
			</div>
			<ApiKeys />
			<Card>
				<CardContent className="flex flex-wrap items-center justify-between gap-6">
					<div className="space-y-2">
						<h2 className="font-semibold">Take the checkout for a spin.</h2>
						<p className="text-sm text-muted-foreground">
							A custom payment form, order confirmation, and a real backend. All in test mode.
						</p>
					</div>
					<Button asChild variant="outline">
						<a href="/checkout">Try test checkout</a>
					</Button>
				</CardContent>
			</Card>
		</AppShell>
	)
}

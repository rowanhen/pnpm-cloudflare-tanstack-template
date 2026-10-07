import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell, appCopy } from '@workspace/shared'

import { getSession } from '../lib/session'
import { api } from '../lib/api'
import { ApiKeys } from '../lib/api-keys'

export const Route = createFileRoute('/')({
	beforeLoad: async () => {
		const user = await getSession()
		if (!user) throw redirect({ to: '/login' })
		return { user }
	},
	component: DashboardHomePage,
})
type Todo = { id: string; title: string; completed: boolean }
type StoredFile = { key: string; size: number }

function DashboardHomePage() {
	const copy = appCopy('Dashboard', 'D1 and R2 example')
	const [hydrated, setHydrated] = useState(false)
	useEffect(() => setHydrated(true), [])
	const { user } = Route.useRouteContext()
	const [title, setTitle] = useState('')
	const [file, setFile] = useState<File | null>(null)
	const client = useQueryClient()
	const todos = useQuery({
		queryKey: ['todos', user.id],
		queryFn: async () => (await (await api('/api/todos')).json()) as { todos: Todo[] },
		retry: false,
	})
	const files = useQuery({
		queryKey: ['files', user.id],
		queryFn: async () =>
			(await (await api('/api/files')).json()) as { files: StoredFile[]; cursor: string | null },
		retry: false,
	})
	const mutation = useMutation({
		mutationFn: async (action: () => Promise<unknown>) => action(),
		onSuccess: async () => {
			await client.invalidateQueries()
		},
	})
	const busy = !hydrated || mutation.isPending
	const error = mutation.error ?? todos.error ?? files.error
	const sectionStyle = { border: '1px solid #475569', padding: 24, marginTop: 24 }
	return (
		<AppShell title={copy.title} description={copy.description} accent="#38bdf8">
			<p>
				Signed in as <strong>{user.email}</strong>
			</p>
			<button
				disabled={!hydrated}
				onClick={async () => {
					await api('/api/auth/sign-out', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: '{}',
					})
					client.clear()
					window.location.assign('/login')
				}}
			>
				Sign out
			</button>
			<ApiKeys />

			{error && (
				<p role="alert" style={{ color: '#fca5a5' }}>
					{error.message}
				</p>
			)}
			<section style={sectionStyle}>
				<h2>D1 todos</h2>
				<form
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
					<label>
						Todo title{' '}
						<input
							disabled={busy}
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							required
							maxLength={200}
						/>
					</label>{' '}
					<button disabled={busy} type="submit">
						Add todo
					</button>
				</form>
				{todos.isPending && <p>Loading todos…</p>}
				<ul>
					{todos.data?.todos.map((item) => (
						<li key={item.id} style={{ marginTop: 12 }}>
							<label>
								<input
									type="checkbox"
									checked={item.completed}
									disabled={busy}
									onChange={() =>
										mutation.mutate(() =>
											api(`/api/todos/${item.id}`, {
												method: 'PATCH',
												headers: { 'Content-Type': 'application/json' },
												body: JSON.stringify({ completed: !item.completed }),
											}),
										)
									}
								/>{' '}
								{item.title}
							</label>{' '}
							<button
								disabled={busy}
								onClick={() =>
									mutation.mutate(() => api(`/api/todos/${item.id}`, { method: 'DELETE' }))
								}
								aria-label={`Delete todo ${item.title}`}
							>
								Delete
							</button>
						</li>
					))}
				</ul>
				{todos.data?.todos.length === 0 && <p>No todos yet.</p>}
			</section>
			<section style={sectionStyle}>
				<h2>R2 files</h2>
				<p>
					Upload up to 5 MiB. Filenames may contain letters, numbers, dots, underscores and hyphens.
					Uploading the same name replaces it.
				</p>
				<form
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
					<label>
						File{' '}
						<input
							type="file"
							required
							onChange={(event) => setFile(event.target.files?.[0] ?? null)}
						/>
					</label>{' '}
					<button disabled={busy || !file} type="submit">
						Upload file
					</button>
				</form>
				{files.isPending && <p>Loading files…</p>}
				<ul>
					{files.data?.files.map((item) => (
						<li key={item.key} style={{ marginTop: 12 }}>
							{item.key} ({item.size} bytes){' '}
							<button
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
							</button>{' '}
							<button
								disabled={busy}
								onClick={() =>
									mutation.mutate(() =>
										api(`/api/files/${encodeURIComponent(item.key)}`, { method: 'DELETE' }),
									)
								}
								aria-label={`Delete file ${item.key}`}
							>
								Delete
							</button>
						</li>
					))}
				</ul>
				{files.data?.files.length === 0 && <p>No files yet.</p>}
				{files.data?.cursor && (
					<p>Showing the first 100 files. Use the REST API cursor to fetch more.</p>
				)}
			</section>
		</AppShell>
	)
}

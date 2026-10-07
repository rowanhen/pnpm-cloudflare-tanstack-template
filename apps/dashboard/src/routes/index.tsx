import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AppShell, appCopy } from '@workspace/shared'

export const Route = createFileRoute('/')({ component: DashboardHomePage })
type Todo = { id: string; title: string; completed: boolean }
type StoredFile = { key: string; size: number }
const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:8787').replace(/\/$/, '')

function DashboardHomePage() {
	const copy = appCopy('Dashboard', 'D1 and R2 example')
	const [hydrated, setHydrated] = useState(false)
	useEffect(() => setHydrated(true), [])
	const [token, setToken] = useState('')
	const [title, setTitle] = useState('')
	const [file, setFile] = useState<File | null>(null)
	const client = useQueryClient()
	async function api(path: string, init: RequestInit = {}) {
		const headers = new Headers(init.headers)
		if (token) headers.set('Authorization', `Bearer ${token}`)
		const response = await fetch(`${apiUrl}${path}`, { ...init, headers })
		if (!response.ok) {
			const body = (await response.json().catch(() => ({}))) as { error?: string }
			throw new Error(body.error ?? `Request failed (${response.status})`)
		}
		return response
	}
	const todos = useQuery({
		queryKey: ['todos', token],
		queryFn: async () => (await (await api('/api/todos')).json()) as { todos: Todo[] },
		retry: false,
	})
	const files = useQuery({
		queryKey: ['files', token],
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
				API: <code>{apiUrl}</code>
			</p>
			<label>
				API token (cloud deployments only){' '}
				<input
					type="password"
					autoComplete="off"
					value={token}
					onChange={(event) => setToken(event.target.value)}
				/>
			</label>
			<p>The token stays in memory. Local development does not require one.</p>
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

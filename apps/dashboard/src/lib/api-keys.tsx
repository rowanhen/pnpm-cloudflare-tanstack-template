import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

type Key = {
	id: string
	name: string
	prefix: string
	created_at: string
	last_used_at: string | null
}
export function ApiKeys() {
	const [name, setName] = useState('')
	const [newToken, setNewToken] = useState('')
	const client = useQueryClient()
	const keys = useQuery({
		queryKey: ['keys'],
		queryFn: async () => (await (await api('/api/keys')).json()) as { keys: Key[] },
	})
	const mutation = useMutation({
		mutationFn: async (action: () => Promise<unknown>) => action(),
		onSuccess: () => client.invalidateQueries({ queryKey: ['keys'] }),
	})
	return (
		<section style={{ border: '1px solid #475569', padding: 24, marginTop: 24 }}>
			<h2>API keys</h2>
			<p>
				Read your private todos from a script. Each key can only call <code>GET /api/v1/todos</code>
				, up to 30 times per minute.
			</p>
			<form
				onSubmit={(event) => {
					event.preventDefault()
					mutation.mutate(async () => {
						const result = await (
							await api('/api/keys', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ name }),
							})
						).json()
						setNewToken(result.key.token)
						setName('')
					})
				}}
			>
				<label>
					Key name{' '}
					<input
						required
						maxLength={60}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</label>{' '}
				<button disabled={mutation.isPending} type="submit">
					Create API key
				</button>
			</form>
			{newToken && (
				<div aria-live="polite">
					<p>Copy this key now. It will not be shown again.</p>
					<label>
						New API key <input readOnly value={newToken} style={{ width: '100%' }} />
					</label>
					<pre
						style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
					>{`curl ${typeof window === 'undefined' ? '' : window.location.origin}/api/v1/todos \\\n  -H 'Authorization: Bearer ${newToken}'`}</pre>
					<button onClick={() => setNewToken('')}>Done, hide key</button>
				</div>
			)}
			{(mutation.error || keys.error) && (
				<p role="alert">{(mutation.error ?? keys.error)?.message}</p>
			)}
			<ul>
				{keys.data?.keys.map((key) => (
					<li key={key.id} style={{ marginTop: 12 }}>
						{key.name} — <code>{key.prefix}…</code>{' '}
						<button
							disabled={mutation.isPending}
							aria-label={`Delete API key ${key.name}`}
							onClick={() =>
								mutation.mutate(async () => {
									await api(`/api/keys/${key.id}`, { method: 'DELETE' })
									setNewToken('')
								})
							}
						>
							Delete key
						</button>
					</li>
				))}
			</ul>
		</section>
	)
}

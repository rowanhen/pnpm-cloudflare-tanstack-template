import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	Label,
	Input,
	Alert,
	AlertDescription,
	useHydrated,
} from '@workspace/shared'
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
	const hydrated = useHydrated()
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
		<Card>
			<CardHeader>
				<CardTitle>
					<h2>API keys</h2>
				</CardTitle>
				<CardDescription>Connect your own tools to your workspace.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<p>
					Read your private todos from a script. Each key can only call{' '}
					<code>GET /api/v1/todos</code>, up to 30 times per minute.
				</p>
				<form
					className="flex flex-wrap items-end gap-3"
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
					<Label className="grid gap-2">
						Key name{' '}
						<Input
							disabled={!hydrated || mutation.isPending}
							required
							maxLength={60}
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
					</Label>{' '}
					<Button disabled={!hydrated || mutation.isPending} type="submit">
						Create API key
					</Button>
				</form>
				{newToken && (
					<div aria-live="polite" className="space-y-3 rounded-lg border bg-secondary p-5">
						<p>Copy this key now. It will not be shown again.</p>
						<Label className="grid gap-2">
							New API key <Input readOnly value={newToken} className="w-full font-mono text-xs" />
						</Label>
						<pre className="whitespace-pre-wrap break-all rounded-md bg-background p-4 text-xs">{`curl ${typeof window === 'undefined' ? '' : window.location.origin}/api/v1/todos \\\n  -H 'Authorization: Bearer ${newToken}'`}</pre>
						<Button onClick={() => setNewToken('')}>Done, hide key</Button>
					</div>
				)}
				{(mutation.error || keys.error) && (
					<Alert variant="destructive">
						<AlertDescription>{(mutation.error ?? keys.error)?.message}</AlertDescription>
					</Alert>
				)}
				<ul>
					{keys.data?.keys.map((key) => (
						<li key={key.id} className="flex flex-wrap items-center gap-3 border-t py-3 text-sm">
							{key.name} — <code>{key.prefix}…</code>{' '}
							<Button
								disabled={!hydrated || mutation.isPending}
								aria-label={`Delete API key ${key.name}`}
								onClick={() =>
									mutation.mutate(async () => {
										await api(`/api/keys/${key.id}`, { method: 'DELETE' })
										setNewToken('')
									})
								}
							>
								Delete key
							</Button>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	)
}

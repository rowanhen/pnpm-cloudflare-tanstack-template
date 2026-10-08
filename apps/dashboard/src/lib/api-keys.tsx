import {
	Button,
	Card,
	Stack,
	Label,
	Input,
	Alert,
	NativeSelect,
	Badge,
	useHydrated,
} from '@workspace/shared'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

type Key = {
	id: string
	name: string
	prefix: string
	scope: string
	created_at: string
	last_used_at: string | null
}
export function ApiKeys() {
	const hydrated = useHydrated()
	const [name, setName] = useState('')
	const [newToken, setNewToken] = useState('')
	const [scope, setScope] = useState('todos:read')
	const [newScope, setNewScope] = useState('todos:read')
	const [exampleId, setExampleId] = useState('')
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
		<Card title={<h2>API keys</h2>} description="30 requests/minute per key.">
			<Stack gap={5}>
				<form
					className="flex flex-wrap items-end gap-3"
					onSubmit={(event) => {
						event.preventDefault()
						mutation.mutate(async () => {
							const result = await (
								await api('/api/keys', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ name, scope }),
								})
							).json()
							setNewToken(result.key.token)
							setNewScope(result.key.scope)
							setExampleId(crypto.randomUUID())
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
					<div className="grid gap-2">
						<Label htmlFor="key-scope">Access</Label>
						<NativeSelect
							id="key-scope"
							size="sm"
							disabled={!hydrated || mutation.isPending}
							value={scope}
							onValueChange={setScope}
							options={[
								{ value: 'todos:read', label: 'Todos · free' },
								{ value: 'summary:read', label: 'Summary · 1 credit' },
							]}
						/>
					</div>
					<Button disabled={!hydrated || mutation.isPending} type="submit">
						Create API key
					</Button>
				</form>
				{newToken && (
					<div aria-live="polite" className="space-y-3 rounded-lg border bg-muted p-5">
						<p>Copy this key now. It will not be shown again.</p>
						<Label className="grid gap-2">
							New API key <Input readOnly value={newToken} className="w-full font-mono text-xs" />
						</Label>
						<pre className="whitespace-pre-wrap break-all rounded-md bg-default p-4 text-xs">
							{[
								`curl ${typeof window === 'undefined' ? '' : window.location.origin}/api/v1/${newScope === 'summary:read' ? 'summary' : 'todos'}`,
								`  -H 'Authorization: Bearer ${newToken}'`,
								...(newScope === 'summary:read'
									? [
											`  -H 'Idempotency-Key: ${exampleId}'`,
											"  -H 'Content-Type: application/json'",
											"  -d '{}'",
										]
									: []),
							].join(' \\\n')}
						</pre>
						<Button onClick={() => setNewToken('')}>Hide key</Button>
					</div>
				)}
				{(mutation.error || keys.error) && (
					<Alert type="negative">{(mutation.error ?? keys.error)?.message}</Alert>
				)}
				<ul>
					{keys.data?.keys.map((key) => (
						<li key={key.id} className="flex flex-wrap items-center gap-3 border-t py-3 text-sm">
							{key.name} — <code>{key.prefix}…</code>
							<Badge variant="outline">
								{key.scope === 'summary:read' ? 'Summary · paid' : 'Todos · free'}
							</Badge>{' '}
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
			</Stack>
		</Card>
	)
}

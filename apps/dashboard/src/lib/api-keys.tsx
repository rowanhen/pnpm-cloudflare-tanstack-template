import {
	Button,
	PageSection,
	Stack,
	Label,
	Input,
	Alert,
	NativeSelect,
	useHydrated,
	Grid,
	Typography,
	CodeBlock,
} from '@workspace/shared'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listKeys, createKey, deleteKey } from '../generated/keys'

import { KeyScope } from '../generated/api.schemas'
export function ApiKeys() {
	const hydrated = useHydrated()
	const [name, setName] = useState('')
	const [newToken, setNewToken] = useState('')
	const [scope, setScope] = useState<KeyScope>('todos:read')
	const [newScope, setNewScope] = useState<KeyScope>('todos:read')
	const [exampleId, setExampleId] = useState('')
	const client = useQueryClient()
	const keys = useQuery({
		queryKey: ['keys'],
		queryFn: async () => (await listKeys()).data,
	})
	const mutation = useMutation({
		mutationFn: async (action: () => Promise<unknown>) => action(),
		onSuccess: () => client.invalidateQueries({ queryKey: ['keys'] }),
	})
	return (
		<PageSection title="API keys" description="30 requests/minute per key.">
			<Stack gap={5}>
				<form
					className="flex flex-wrap items-end gap-3"
					onSubmit={(event) => {
						event.preventDefault()
						mutation.mutate(async () => {
							const { data: result } = await createKey({ name, scope })
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
					<Grid gap={2} columns={1}>
						<Label htmlFor="key-scope">Access</Label>
						<NativeSelect
							id="key-scope"
							size="sm"
							disabled={!hydrated || mutation.isPending}
							value={scope}
							onValueChange={(value) =>
								setScope(
									value === KeyScope['summary:read']
										? KeyScope['summary:read']
										: KeyScope['todos:read'],
								)
							}
							options={[
								{ value: 'todos:read', label: 'Todos · free' },
								{ value: 'summary:read', label: 'Summary · 1 credit' },
							]}
						/>
					</Grid>
					<Button disabled={!hydrated || mutation.isPending} type="submit">
						Create API key
					</Button>
				</form>
				{newToken && (
					<Stack gap={3} aria-live="polite" className="rounded-lg border bg-muted p-5">
						<Typography as="p" variant="body-200">
							Copy this key now. It will not be shown again.
						</Typography>
						<Label className="grid gap-2">
							New API key <Input readOnly value={newToken} className="w-full font-mono" />
						</Label>
						<CodeBlock>
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
						</CodeBlock>
						<Button onClick={() => setNewToken('')}>Hide key</Button>
					</Stack>
				)}
				{(mutation.error || keys.error) && (
					<Alert type="negative">{(mutation.error ?? keys.error)?.message}</Alert>
				)}
				<ul>
					{keys.data?.keys.map((key) => (
						<li key={key.id} className="flex flex-wrap items-center gap-3 border-t py-3">
							<Typography as="span" variant="body-100">
								{key.name}
							</Typography>
							<Typography as="span" variant="caption-100" className="font-mono">
								{key.prefix}…
							</Typography>
							<Typography as="span" variant="body-200" className="text-content-secondary">
								{key.scope === 'summary:read' ? 'Summary · paid' : 'Todos · free'}
							</Typography>{' '}
							<Button
								variant="destructive"
								disabled={!hydrated || mutation.isPending}
								aria-label={`Delete API key ${key.name}`}
								onClick={() =>
									mutation.mutate(async () => {
										await deleteKey(key.id)
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
		</PageSection>
	)
}

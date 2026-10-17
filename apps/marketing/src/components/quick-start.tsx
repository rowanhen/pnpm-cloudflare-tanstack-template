import { ClipboardText, useHydrated, Typography } from '@workspace/shared'

import { repository } from '../lib/seo'

const commands = [
	{ label: 'Clone', value: `git clone ${repository}.git my-idea` },
	{ label: 'Install', value: 'cd my-idea && npm install --global pnpm@10.34.7 && pnpm install' },
	{ label: 'Run', value: 'pnpm dev' },
]
export function QuickStart() {
	const hydrated = useHydrated()
	return (
		<div className="overflow-hidden rounded-lg border bg-surface-default">
			<ol className="space-y-5 p-5 sm:p-6">
				{commands.map((command) => (
					<li key={command.label} className="min-w-0 space-y-2">
						<Typography as="p" variant="caption-100" className="text-content-secondary">
							{command.label}
						</Typography>
						<ClipboardText
							disabled={!hydrated}
							text={command.value}
							tooltip={false}
							labels={{ copyAction: `Copy ${command.label.toLowerCase()} command` }}
						/>
					</li>
				))}
			</ol>
		</div>
	)
}

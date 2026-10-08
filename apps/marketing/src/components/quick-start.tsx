import { ClipboardText, LayerCard, useHydrated } from '@workspace/shared'
import { repository } from '../lib/seo'

const commands = [
	{ label: 'Clone', value: `git clone ${repository}.git my-idea` },
	{ label: 'Install', value: 'cd my-idea && corepack enable && pnpm install' },
	{ label: 'Run', value: 'pnpm dev' },
]
export function QuickStart() {
	const hydrated = useHydrated()
	return (
		<LayerCard
			title={<span className="font-mono text-xs">~/my-idea</span>}
			footer={
				<span className="text-xs text-content-secondary">
					Node 22.12+ · pnpm 10 · No cloud account needed locally
				</span>
			}
		>
			<ol className="space-y-6 py-2">
				{commands.map((command, index) => (
					<li key={command.label} className="min-w-0 space-y-2">
						<p className="text-xs text-content-secondary">
							<span className="mr-2 font-mono">0{index + 1}</span>
							{command.label}
						</p>
						<ClipboardText
							disabled={!hydrated}
							text={command.value}
							tooltip={false}
							labels={{ copyAction: `Copy ${command.label.toLowerCase()} command` }}
						/>
					</li>
				))}
			</ol>
		</LayerCard>
	)
}

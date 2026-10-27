import { Badge, Button, ClipboardText, LayerCard, Typography, useHydrated } from '@workspace/shared'
import { track } from '@workspace/observability/browser'
import { MarketingShell } from '../components/marketing-shell'
import { WaitlistForm } from '../components/waitlist-form'
import { seo, site } from '../lib/seo'
import { markdownPath } from './model'
import type { ContentBlock, PublishedPage } from './model'

export function pageHead(page: PublishedPage) {
	const head = seo(
		page.path,
		page.seo.title,
		page.seo.description,
		page.seo.noindex,
		page.kind === 'guide',
	)
	return {
		...head,
		links: [
			...head.links,
			{ rel: 'alternate', type: 'text/markdown', href: markdownPath(page.path) },
		],
	}
}
function Block({ block }: { block: ContentBlock }) {
	const hydrated = useHydrated()
	switch (block.kind) {
		case 'paragraph':
			return <p className="text-content-secondary leading-7">{block.text}</p>
		case 'list': {
			const Tag = block.ordered ? 'ol' : 'ul'
			return (
				<Tag className={`space-y-3 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
					{block.items.map((item, i) => (
						<li key={i}>{item}</li>
					))}
				</Tag>
			)
		}
		case 'commands':
			return (
				<LayerCard footer={block.note}>
					<ol className="space-y-6">
						{block.items.map((item) => (
							<li key={item.label} className="space-y-2">
								<p>{item.label}</p>
								<ClipboardText
									disabled={!hydrated}
									text={item.value}
									tooltip={false}
									labels={{ copyAction: `Copy ${item.label.toLowerCase()} command` }}
								/>
							</li>
						))}
					</ol>
				</LayerCard>
			)
		case 'links':
			return (
				<nav aria-label={block.label} className="grid gap-4">
					{block.items.map((item) => (
						<a key={item.href} href={item.href} className="text-link hover:underline">
							{item.label}
							{item.detail && (
								<span className="ml-2 text-sm text-content-secondary">{item.detail}</span>
							)}
						</a>
					))}
				</nav>
			)
		case 'features':
			return (
				<div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-3">
					{block.items.map((item) => (
						<article key={item.title} className="space-y-3">
							<Badge variant="outline">{item.tag}</Badge>
							<h3 className="font-semibold">{item.title}</h3>
							<p className="text-content-secondary">{item.description}</p>
						</article>
					))}
				</div>
			)
		case 'waitlist':
			return (
				<div className="max-w-xl">
					<WaitlistForm title={block.title} />
				</div>
			)
	}
	const unsupported: never = block
	throw new Error(`Unsupported content block: ${unsupported}`)
}
export function ContentPage({ page }: { page: PublishedPage }) {
	const data = {
		'@context': 'https://schema.org',
		'@type': page.kind === 'guide' ? 'Article' : page.path === '/' ? 'WebSite' : 'WebPage',
		name: page.seo.title,
		headline: [page.title, page.accent].filter(Boolean).join(' '),
		description: page.seo.description,
		url: `${site.url}${page.path}`,
	}
	return (
		<MarketingShell>
			<div className={page.kind === 'landing' ? '' : 'mx-auto max-w-2xl'}>
				<header className="space-y-7 py-16">
					{page.eyebrow && <Badge variant="outline">{page.eyebrow}</Badge>}
					<Typography as="h1" variant="hero-300" className="text-5xl tracking-tight sm:text-6xl">
						{page.title}
						{page.accent && (
							<>
								<br />
								<span className="text-brand">{page.accent}</span>
							</>
						)}
					</Typography>
					{page.intro && (
						<p className="max-w-xl text-lg leading-7 text-content-secondary">{page.intro}</p>
					)}
					<div className="flex flex-wrap gap-3">
						{page.actions?.map((action, i) => (
							<Button key={action.href} asChild size="lg" variant={i === 0 ? 'default' : 'outline'}>
								<a
									href={action.href}
									onClick={() => {
										if (action.event) track(action.event, {})
									}}
								>
									{action.label}
								</a>
							</Button>
						))}
					</div>
				</header>
				{page.sections.map((section) => (
					<section
						key={section.id}
						id={section.id}
						aria-labelledby={`${section.id}-title`}
						className="space-y-7 border-t py-12"
					>
						<h2 id={`${section.id}-title`} className="text-2xl font-semibold tracking-tight">
							{section.title}
						</h2>
						{section.blocks.map((block, i) => (
							<Block key={i} block={block} />
						))}
					</section>
				))}
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
				/>
			</div>
		</MarketingShell>
	)
}

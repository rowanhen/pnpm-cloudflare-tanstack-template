/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Composables renders anchors below; override Base UI's default button role. */
import {
	Badge,
	Button,
	ClipboardText,
	LayerCard,
	Typography,
	useHydrated,
	Stack,
	Section,
	Grid,
} from '@workspace/shared'
import { Link } from '@tanstack/react-router'
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
			return (
				<Typography as="p" variant="body-200" className="text-content-secondary leading-7">
					{block.text}
				</Typography>
			)
		case 'list': {
			const Tag = block.ordered ? 'ol' : 'ul'
			return (
				<Tag className={`space-y-3 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
					{block.items.map((item, i) => (
						<li key={i}>
							<Typography as="p" variant="body-200">
								{item}
							</Typography>
						</li>
					))}
				</Tag>
			)
		}
		case 'commands':
			return (
				<LayerCard
					footer={
						<Typography as="p" variant="caption-100">
							{block.note}
						</Typography>
					}
				>
					<ol className="space-y-6">
						{block.items.map((item) => (
							<li key={item.label} className="space-y-2">
								<Typography as="p" variant="body-100">
									{item.label}
								</Typography>
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
						<div key={item.href} className="space-y-1">
							<Button
								role="link"
								{...{ nativeButton: false }}
								variant="link"
								render={
									item.href.startsWith('/') && !item.href.startsWith('//') ? (
										<Link to={item.href} />
									) : (
										<a href={item.href} aria-label={item.label} />
									)
								}
							>
								{item.label}
							</Button>
							{item.detail && (
								<Typography as="p" variant="body-100" className="text-content-secondary">
									{item.detail}
								</Typography>
							)}
						</div>
					))}
				</nav>
			)
		case 'features':
			return (
				<Grid columns={1} className="sm:grid-cols-2 lg:grid-cols-3" gap={8}>
					{block.items.map((item) => (
						<article key={item.title} className="space-y-3">
							<Badge variant="outline">{item.tag}</Badge>
							<Typography as="h3" variant="heading-200">
								{item.title}
							</Typography>
							<Typography as="p" variant="body-200" className="text-content-secondary">
								{item.description}
							</Typography>
						</article>
					))}
				</Grid>
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
				<header className="py-16">
					<Stack gap={8}>
						{page.eyebrow && <Badge variant="outline">{page.eyebrow}</Badge>}
						<Typography as="h1" variant="hero-300">
							{page.title}
							{page.accent && (
								<>
									<br />
									<Typography as="span" variant="hero-300" className="text-brand">
										{page.accent}
									</Typography>
								</>
							)}
						</Typography>
						{page.intro && (
							<Typography
								as="p"
								variant="body-300"
								className="max-w-xl leading-7 text-content-secondary"
							>
								{page.intro}
							</Typography>
						)}
						<div className="flex flex-wrap gap-3">
							{page.actions?.map((action, i) => (
								<Button
									role="link"
									{...{ nativeButton: false }}
									key={action.href}
									size="lg"
									variant={i === 0 ? 'default' : 'outline'}
									render={
										action.href.startsWith('#') ? (
											<Link to="." hash={action.href.slice(1)} />
										) : action.href.startsWith('/') && !action.href.startsWith('//') ? (
											<Link to={action.href} />
										) : (
											<a href={action.href} aria-label={action.label} />
										)
									}
									onClick={() => {
										if (action.event) track(action.event, {})
									}}
								>
									{action.label}
								</Button>
							))}
						</div>
					</Stack>
				</header>
				{page.sections.map((section) => (
					<Section
						spacing="lg"
						key={section.id}
						id={section.id}
						aria-labelledby={`${section.id}-title`}
						className="border-t"
					>
						<Stack gap={8}>
							<Typography as="h2" variant="heading-400" id={`${section.id}-title`}>
								{section.title}
							</Typography>
							{section.blocks.map((block, i) => (
								<Block key={i} block={block} />
							))}
						</Stack>
					</Section>
				))}
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
				/>
			</div>
		</MarketingShell>
	)
}

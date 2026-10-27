export type ContentLink = {
	label: string
	href: string
	detail?: string
	event?: 'template.opened'
}
export type ContentBlock =
	| { kind: 'paragraph'; text: string }
	| { kind: 'list'; items: string[]; ordered?: boolean }
	| { kind: 'commands'; items: { label: string; value: string }[]; note: string }
	| { kind: 'links'; label: string; items: ContentLink[] }
	| { kind: 'features'; items: { title: string; description: string; tag: string }[] }
	| { kind: 'waitlist'; title: string }

/** Plain data only: every block must be supported by both HTML and Markdown renderers. */
export type MarketingPage = {
	kind: 'landing' | 'guide' | 'legal'
	status: 'draft' | 'published'
	seo: { title: string; description: string; noindex?: boolean }
	title: string
	accent?: string
	eyebrow?: string
	intro: string
	actions?: ContentLink[]
	sections: { id: string; title: string; blocks: ContentBlock[] }[]
}
export type PublishedPage = MarketingPage & { path: string }
export const markdownPath = (path: string) => (path === '/' ? '/index.md' : `${path}.md`)

export function createCatalog(
	modules: Record<string, { default: MarketingPage }>,
): PublishedPage[] {
	return Object.entries(modules)
		.flatMap(([file, module]) => {
			const path = file.replace('../routes', '').replace('/-content.ts', '') || '/'
			if (!/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(path))
				throw new Error(`Invalid content path: ${file}`)
			const page = module.default
			if (!page.seo.title.trim() || !page.seo.description.trim() || !page.title.trim())
				throw new Error(`Missing page metadata: ${file}`)
			const ids = page.sections.map((section) => section.id)
			if (new Set(ids).size !== ids.length || ids.some((id) => !/^[a-z][a-z0-9-]*$/.test(id)))
				throw new Error(`Invalid section IDs: ${file}`)
			return page.status === 'published' ? [{ ...page, path }] : []
		})
		.sort((a, b) => a.path.localeCompare(b.path))
}

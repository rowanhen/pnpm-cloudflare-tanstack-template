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

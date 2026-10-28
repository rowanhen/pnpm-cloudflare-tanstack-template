import type { Heading, Link, Paragraph, PhrasingContent, RootContent } from 'mdast'
import { toMarkdown } from 'mdast-util-to-markdown'
import type { ContentBlock, PublishedPage } from './model'
import { markdownPath } from './model'

const paragraph = (value: string): Paragraph => ({
	type: 'paragraph',
	children: [{ type: 'text', value }],
})
const heading = (depth: Heading['depth'], value: string): Heading => ({
	type: 'heading',
	depth,
	children: [{ type: 'text', value }],
})
const link = (label: string, href: string, origin: string): Link => ({
	type: 'link',
	url: new URL(href, origin).href,
	children: [{ type: 'text', value: label }],
})
const list = (items: PhrasingContent[][], ordered = false): RootContent => ({
	type: 'list',
	ordered,
	children: items.map((children) => ({
		type: 'listItem',
		children: [{ type: 'paragraph', children }],
	})),
})
const serialize = (children: RootContent[]) =>
	toMarkdown({ type: 'root', children }, { bullet: '-', fences: true })

function blockContent(block: ContentBlock, origin: string): RootContent[] {
	switch (block.kind) {
		case 'paragraph':
			return [paragraph(block.text)]
		case 'list':
			return [
				list(
					block.items.map((value) => [{ type: 'text', value }]),
					block.ordered,
				),
			]
		case 'commands':
			return [
				...block.items.flatMap((item): RootContent[] => [
					heading(3, item.label),
					{ type: 'code', lang: 'sh', value: item.value },
				]),
				paragraph(block.note),
			]
		case 'links':
			return [
				list(
					block.items.map((item) => [
						link(item.label, item.href, origin),
						...(item.detail ? [{ type: 'text' as const, value: `: ${item.detail}` }] : []),
					]),
				),
			]
		case 'features':
			return block.items.flatMap((item) => [
				heading(3, item.title),
				paragraph(item.description),
				paragraph(item.tag),
			])
		case 'waitlist':
			return [{ type: 'paragraph', children: [link(block.title, '#waitlist', origin)] }]
	}
}
export function renderMarkdown(page: PublishedPage, origin: string): string {
	const url = new URL(page.path, origin).href
	return serialize([
		heading(1, [page.title, page.accent].filter(Boolean).join(' ')),
		paragraph(page.seo.description),
		...(page.eyebrow ? [paragraph(page.eyebrow)] : []),
		...(page.intro ? [paragraph(page.intro)] : []),
		...(page.actions ?? []).map((item): Paragraph => ({
			type: 'paragraph',
			children: [link(item.label, item.href, url)],
		})),
		...page.sections.flatMap((section) => [
			heading(2, section.title),
			...section.blocks.flatMap((block) => blockContent(block, url)),
		]),
		{ type: 'paragraph', children: [link('Website page', url, origin)] },
	])
}
export function renderLlms(
	pages: PublishedPage[],
	site: { name: string; description: string; url: string },
): string {
	return serialize([
		heading(1, site.name),
		{ type: 'blockquote', children: [paragraph(site.description)] },
		heading(2, 'Pages'),
		...(pages.some((page) => !page.seo.noindex)
			? [
					list(
						pages
							.filter((page) => !page.seo.noindex)
							.map((page) => [
								link(page.seo.title, markdownPath(page.path), site.url),
								{ type: 'text', value: `: ${page.seo.description}` },
							]),
					),
				]
			: []),
	])
}
export function renderSitemap(pages: PublishedPage[], origin: string): string {
	const xml = (value: string) =>
		value.replace(
			/[<>&"']/g,
			(char) =>
				({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char] ?? char,
		)
	return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages
		.filter((page) => !page.seo.noindex)
		.map((page) => `<url><loc>${xml(new URL(page.path, origin).href)}</loc></url>`)
		.join('')}</urlset>`
}

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCatalog } from '../../apps/marketing/src/publishing/model'
import {
	renderMarkdown,
	renderLlms,
	renderSitemap,
} from '../../apps/marketing/src/publishing/markdown'
import type { ContentBlock, MarketingPage } from '../../apps/marketing/src/publishing/model'

const page: MarketingPage = {
	kind: 'guide',
	status: 'published',
	title: 'A <guide>',
	seo: { title: 'Guide', description: 'Description & details' },
	intro: 'Start here.',
	sections: [
		{
			id: 'start',
			title: 'Start',
			blocks: [
				{ kind: 'paragraph', text: 'Plain *text* <script>' },
				{ kind: 'commands', items: [{ label: 'Run', value: 'echo ```' }], note: 'A command' },
				{ kind: 'links', label: 'Links', items: [{ label: 'Next', href: '/next' }] },
			],
		},
	],
}
test('catalog follows directories and withholds drafts', () => {
	const pages = createCatalog({
		'../routes/-content.ts': { default: page },
		'../routes/guides/start/-content.ts': { default: page },
		'../routes/draft/-content.ts': { default: { ...page, status: 'draft' } },
	})
	assert.deepEqual(
		pages.map((item) => item.path),
		['/', '/guides/start'],
	)
	assert.throws(
		() => createCatalog({ '../routes/Bad Path/-content.ts': { default: page } }),
		/Invalid content path/,
	)
	assert.throws(
		() =>
			createCatalog({
				'../routes/-content.ts': {
					default: { ...page, sections: [...page.sections, ...page.sections] },
				},
			}),
		/Invalid section IDs/,
	)
})
test('outputs use canonical URLs, escape text and omit noindex discovery entries', () => {
	const visible = { ...page, path: '/guides/start' }
	const hidden = { ...page, path: '/hidden', seo: { ...page.seo, noindex: true } }
	const site = { name: 'Starter', description: 'A starter', url: 'https://example.com' }
	const markdown = renderMarkdown(visible, site.url)
	assert.ok(markdown.includes('Plain \\*text\\* \\<script>'))
	assert.ok(markdown.includes('````sh\necho ```\n````'))
	assert.ok(markdown.includes('[Next](https://example.com/next)'))
	const llms = renderLlms([visible, hidden], site)
	assert.ok(llms.includes('https://example.com/guides/start.md'))
	assert.ok(!llms.includes('/hidden'))
	const sitemap = renderSitemap([visible, hidden], site.url)
	assert.ok(sitemap.includes('<loc>https://example.com/guides/start</loc>'))
	assert.ok(!sitemap.includes('/hidden'))
})

test('every supported content block has a useful Markdown representation', () => {
	const blocks = {
		paragraph: { kind: 'paragraph', text: 'Paragraph content' },
		list: { kind: 'list', ordered: true, items: ['First item', 'Second item'] },
		commands: {
			kind: 'commands',
			items: [{ label: 'Run example', value: 'pnpm dev' }],
			note: 'Command note',
		},
		links: {
			kind: 'links',
			label: 'Resources',
			items: [{ label: 'Guide', href: '/guide', detail: 'Read more' }],
		},
		features: {
			kind: 'features',
			items: [{ title: 'Feature title', description: 'Feature description', tag: 'Feature tag' }],
		},
		waitlist: { kind: 'waitlist', title: 'Join the waitlist' },
	} satisfies { [K in ContentBlock['kind']]: Extract<ContentBlock, { kind: K }> }
	const output = renderMarkdown(
		{
			...page,
			path: '/',
			sections: [{ id: 'all', title: 'All blocks', blocks: Object.values(blocks) }],
		},
		'https://example.com',
	)
	for (const content of [
		'Paragraph content',
		'1. First item',
		'2. Second item',
		'Run example',
		'pnpm dev',
		'Command note',
		'[Guide](https://example.com/guide): Read more',
		'Feature title',
		'Feature description',
		'Feature tag',
		'[Join the waitlist](https://example.com/#waitlist)',
	])
		assert.ok(output.includes(content), content)
})

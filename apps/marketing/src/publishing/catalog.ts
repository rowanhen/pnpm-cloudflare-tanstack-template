import type { MarketingPage, PublishedPage } from './model'

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

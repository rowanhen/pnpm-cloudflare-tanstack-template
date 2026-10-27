import type { MarketingPage } from './model'
import { createCatalog } from './model'

const modules = import.meta.glob<{ default: MarketingPage }>('../routes/**/-content.ts', {
	eager: true,
})
export const pages = createCatalog(modules)
export const findPage = (path: string) => pages.find((page) => page.path === path) ?? null

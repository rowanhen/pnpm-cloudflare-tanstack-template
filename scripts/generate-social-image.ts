import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { root } from './setup-env.ts'

const font = await readFile(
	resolve(
		root,
		'packages/shared/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
	),
)
const browser = await chromium.launch()
try {
	const page = await browser.newPage({
		viewport: { width: 1200, height: 630 },
		deviceScaleFactor: 1,
	})
	await page.setContent(`<!doctype html><html><head><style>
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900}
*{box-sizing:border-box}body{margin:0;background:#fbfbfb;color:#171717;font-family:Inter,sans-serif;padding:64px}header{font-size:22px;font-weight:650}h1{font-size:76px;line-height:1.06;letter-spacing:-3px;font-weight:650;margin:72px 0 24px}h1 span{color:#a93600}p{font-size:24px;color:#737373}footer{position:absolute;left:64px;right:64px;bottom:48px;border-top:1px solid #e5e5e5;padding-top:24px;display:flex;justify-content:space-between;color:#737373;font-size:17px}
</style></head><body><header>Cloudflare Starter.</header><h1>Your next idea.<br><span>Already started.</span></h1><p>Auth, data, files, payments and email. One TypeScript repo.</p><footer><span>TanStack Start · Drizzle · Composables / Kumo</span><span>Built by Leitware ↗</span></footer></body></html>`)
	await page.evaluate(() => document.fonts.ready)
	await page.screenshot({ path: resolve(root, 'apps/marketing/public/og.png') })
} finally {
	await browser.close()
}

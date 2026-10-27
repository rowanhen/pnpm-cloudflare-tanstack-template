# Marketing content

Each public page owns one `apps/marketing/src/routes/**/-content.ts` file. Its directory is its canonical URL: `routes/-content.ts` is `/`, and `routes/guides/getting-started/-content.ts` is `/guides/getting-started`. Use lowercase, hyphenated path segments. TanStack ignores the `-content` files; the publishing catch-all renders their pages. Explicit application routes (API, success, error) remain separate and take priority. Do not place content under those reserved routes. Home and privacy have explicit routes that use the same content loader and template; other content pages use the catch-all.

Export a default object using `satisfies MarketingPage` from `publishing/model.ts`. Keep page copy, links, sections and SEO in this file. Shared site identity and default social image remain in `lib/seo.ts`; interactive form labels and navigation remain in their components. `kind` selects landing, guide or legal presentation. Set `status: 'published'` to release; drafts are inaccessible in HTML and Markdown, including in development. Content is discovered on the server and changes require a build/deploy in production.

The shared template uses Composables typography and buttons, and TanStack links for internal navigation. It renders headings, paragraphs, lists, commands, features, links and the waitlist form. Buttons rendered as links pass `nativeButton: false` through a spread because Composables 2.0 forwards this Base UI prop but omits it from its public TypeScript interface. Content is plain text, not raw HTML or inline Markdown. Markdown pages and `llms.txt` are serialized by `mdast-util-to-markdown` from typed mdast nodes; the package owns escaping, link syntax, lists and code fences. Add a discriminated block variant to the model and implement it in both `publishing/page.tsx` and `publishing/markdown.ts` when a new presentation is needed. Keep interactive behaviour in components; give each widget a useful Markdown representation.

Published pages automatically receive:

- Canonical, description, Open Graph, Twitter and JSON-LD metadata.
- A Markdown alternate at `<page>.md` (`/index.md` for the homepage).
- An entry in `/llms.txt` and `/sitemap.xml`, unless `seo.noindex` is set.

`VITE_NOINDEX=true` and localhost deployments disable indexing globally and emit an empty sitemap. Markdown responses carry `X-Robots-Tag: noindex` to avoid duplicate indexed content. Noindex is discovery policy, not access control; use draft status to withhold a page. The site URL configured with `VITE_SITE_URL` is authoritative for generated absolute links.

To add a guide, copy `routes/guides/getting-started/-content.ts` into a new directory, edit its content and publish it. No registry or additional route file is needed. Link to it from relevant page content or site navigation. Validate with `pnpm --filter marketing typecheck`, `pnpm build:marketing`, and `pnpm test:unit`. Review navigation and rendering in the browser; the current template intentionally has no browser E2E tooling.

The publishing layer has five modules: `model.ts` defines and validates content, `catalog.server.ts` discovers published pages on the server, `catalog.ts` exposes the server loader used during SSR and client navigation, `page.tsx` renders HTML and metadata, and `markdown.ts` generates text/discovery outputs. The server boundary keeps the full catalog and draft content out of browser bundles.

# Repository guide

Read [the one-page structure guide](docs/architecture.md) before changing application architecture or adding API features. Use [the detailed API walkthrough](docs/api-architecture.md) for implementation conventions and current limitations.

- Keep operational commands in `scripts/` and tests/fixtures in the corresponding `tests/` folders.
- Use the Node and pnpm versions pinned in `.nvmrc` and `package.json`.
- Build every new page and UI state with the public `@leitware/composables` components, imported through the direct exports in `@workspace/shared`. Apply this to marketing, dashboard, auth, checkout, privacy, success, loading, error and 404 pages.
- Use `Typography` with the appropriate variant and semantic `as` for headings, paragraphs and inline text; do not add loose `<p>`, `<span>` or heading tags. Use the library's form controls, status components, `CodeBlock`, `Container`, `Section`, `Stack` and `Grid` wherever they fit. Use `Container maxWidth="md"` for page content and keep copy brief.
- Use the public DropZone components for file selection/upload. Use `Button variant="destructive"` for deleting/revoking data and known file replacements.
- Use the existing `Button variant="link"` for text links. For internal navigation, compose the library button with `render={<Link ... />}` from `@tanstack/react-router`; preserve each app's router registration so paths, search parameters and hashes use the typed routing API. Use typed `navigate` for imperative in-app navigation. Keep cross-origin links and authentication handoffs as document navigations.
- Do not create button/link wrappers, router-button adapters, variant aliases, replacement components or custom styling to reproduce an existing Composables component. Prefer public variants and layout props; only add necessary layout/responsive classes. Keep theme changes in the shared stylesheet and preserve its import order. Keep native document, form and list semantics when no library component fits. See `docs/reference.md` for rendered-link semantics and the installed package's `nativeButton` typing limitation.
- Define new API operations in `packages/contracts/openapi/features/`; reuse schemas and errors from `openapi/shared/`. Register each path with a `$ref` in `openapi/api.json`.
- Configure generation in `orval.config.ts`; keep custom generation in `codegen/` using Orval extension points.
- Run `pnpm api:generate` after contract changes. Never hand-edit `src/generated/` files.
- Implement behaviour in the scaffolded feature handlers. Preserve ownership checks and select public database columns explicitly.
- Replace unresolved `TODO_IMPLEMENT_OPERATION` scaffold expressions with typed implementations; ordinary TypeScript checking rejects unfinished handlers.
- Run `pnpm check` before committing. CI runs lint/formatting, unit tests, TypeScript and builds in that order, followed by a separate deployment job on main. API integration tests remain local. Browser E2E tooling is not included. Review frontend changes manually in the browser.
- Run Orval after contract changes and review generated output. Generation cleans only generated directories; never put handwritten code there.
- Use Wrangler and provider tools for provisioning and deployment; see `docs/manual-deployment.md`.
- Keep provider setup/deployment instructions in the existing docs. Follow the actual scope of the migrated feature; other integrations still use their existing handlers.

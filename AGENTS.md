# Repository guide

Read [the one-page structure guide](docs/architecture.md) before changing application architecture or adding API features. Use [the detailed API walkthrough](docs/api-architecture.md) for implementation conventions and current limitations.

- Keep operational commands in `scripts/` and tests/fixtures in the corresponding `tests/` folders.
- Use the Node and pnpm versions pinned in `.nvmrc` and `package.json`.
- Define new API operations in `packages/contracts/openapi/features/`; reuse schemas and errors from `openapi/shared/`. Register each path with a `$ref` in `openapi/api.json`.
- Configure generation in `orval.config.ts`; keep custom generation in `codegen/` using Orval extension points.
- Run `pnpm api:generate` after contract changes. Never hand-edit `src/generated/` files.
- Implement behaviour in the scaffolded feature handlers. Preserve ownership checks and select public database columns explicitly.
- Replace unresolved `TODO_IMPLEMENT_OPERATION` scaffold expressions with typed implementations; ordinary TypeScript checking rejects unfinished handlers.
- Run `pnpm check` before committing. Run relevant browser tests for frontend changes; CI runs both production and development browser suites.
- CI runs Orval and checks Git status for changed and new generated files. Generation cleans only generated directories; never put handwritten code there.
- Use Wrangler and provider tools for provisioning and deployment; see `docs/manual-deployment.md`.
- Keep provider setup/deployment instructions in the existing docs. Follow the actual scope of the migrated feature; other integrations still use their existing handlers.

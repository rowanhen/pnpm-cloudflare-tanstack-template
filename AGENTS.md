# Repository guide

Read [the one-page structure guide](docs/architecture.md) before changing application architecture or adding API features. Use [the detailed API walkthrough](docs/api-architecture.md) for implementation conventions and current limitations.

- Use the Node and pnpm versions pinned in `.nvmrc` and `package.json`.
- Define new API operations in `packages/contracts/openapi/features/`; reuse schemas and errors from `openapi/shared/`.
- Run `pnpm api:generate` after contract changes. Never hand-edit `src/generated/` files.
- Implement behaviour in the scaffolded feature handlers. Preserve ownership checks and select public database columns explicitly.
- Remove `TODO_IMPLEMENT_OPERATION` markers only after implementing the corresponding behaviour.
- Run `pnpm check` before committing. Run relevant browser tests for frontend changes; CI runs both production and development browser suites.
- Keep provider setup/deployment instructions in the existing docs. Follow the actual scope of the migrated feature; other integrations still use their existing handlers.

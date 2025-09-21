# ai-workflows

Monorepo for drop-in AI-enhanced dev workflows.

## packages
- `@aiwf/core` — shared types/utilities (finding schema, hashing, comment utils)
- `@aiwf/runners` — adapters for tools (Lighthouse, axe, bundle)
- `@aiwf/action-cwv` — GitHub Action wrapper for Core Web Vitals checks
- `@aiwf/cli-cwv` — CLI to run CWV locally or in any CI

## scripts
- `pnpm build` — build all packages
- `pnpm lint` — biome check
- `pnpm format` — biome format
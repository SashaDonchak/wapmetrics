# WAPMetrics (Norm) - Project Context

## Overview

WAPMetrics is a web performance monitoring tool built on top of Lighthouse CI. It uses a custom configuration format (`normrc.json`) that gets transformed into LHCI-compatible configs.

## Architecture

```
wapmetrics/
├── packages/
│   ├── schemas/         # Shared TypeScript types (Manifest, LhciSummaryItem)
│   ├── config/          # normrc.json loader + transformer to LHCI format
│   ├── lhci-collector/  # Runs LHCI with config, outputs reports
│   ├── uploader/        # Uploads artifacts to WAPMetrics API
│   └── collector-action/# GitHub Action entrypoint (bundles everything)
```

## Key Files

- `normrc.json` - User-facing config file (baseUrl, routes, budgets, device preset)
- `packages/config/src/index.ts` - Config schema + `loadConfig()` + `transformConfig()`
- `packages/lhci-collector/src/index.ts` - `runLhci()` function + `makeManifest()`
- `packages/collector-action/action.yml` - GitHub Action interface
- `packages/collector-action/src/index.ts` - Action entrypoint

## Package Manager

**pnpm** with workspaces. Version: 10.11.0

## Key Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build the collector-action bundle |
| `pnpm type-check` | TypeScript check all packages |
| `pnpm lint` | Run Biome linter |
| `pnpm lint:fix` | Auto-fix lint issues |

## Configuration Flow

1. User creates `normrc.json` with settings, routes, and optional budgets
2. `loadConfig()` reads and validates the file
3. `transformConfig()` converts to LHCI format
4. `runLhci()` executes Lighthouse CI with the transformed config
5. Results are packaged into `wapmetrics-run.tgz` with a manifest

## Conventions

- All packages use TypeScript with ES modules (`"type": "module"`)
- Shared types go in `@wapmetrics/schemas`
- The collector-action is bundled with `tsup` for GitHub Actions compatibility
- Config validation happens in `loadConfig()`, transformation in `transformConfig()`

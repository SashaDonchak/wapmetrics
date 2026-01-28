---
description: How to verify changes after making code edits in the wapmetrics monorepo
---

# Verification Workflow

After making code edits, run these commands in order to ensure everything works:

## 1. Type Check (Required)
// turbo
```bash
pnpm type-check
```
Ensures all TypeScript types are correct across all packages.

## 2. Lint Check (Required)
// turbo
```bash
pnpm lint
```
Catches style issues and potential bugs. Uses Biome.

## 3. Build (Required)
// turbo
```bash
pnpm build
```
Compiles the collector-action bundle. Must pass before deployment.

## 4. Fix Linting Issues (If Needed)
// turbo
```bash
pnpm lint:fix
```
Automatically fixes fixable lint issues.

---

## When to Run

- **After any TypeScript changes**: Run all 3 checks
- **After config changes (`turbo.json`, `tsconfig.*.json`)**: Run full verification
- **Before pushing to GitHub**: Always run full verification

## Common Issues

- **Type errors**: Check that interfaces in `@wapmetrics/schemas` and `@wapmetrics/config` are in sync
- **Build fails but type-check passes**: Check `tsup.config.ts` in collector-action
- **Lint errors**: Run `pnpm lint:fix` first, then manually fix remaining issues

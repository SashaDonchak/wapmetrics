---
description: How to make changes to the normrc.json configuration schema or add new config options
---

# Updating Config Schema Workflow

When adding or modifying configuration options for `normrc.json`:

## 1. Update Schema Types

Edit `packages/config/src/index.ts`:
- Add new fields to the relevant interface (`NormRc`, `ProjectSettings`, `Budget`, etc.)
- Ensure optional fields use `?` suffix

## 2. Update Config Loader (if needed)

If adding required fields, update the `loadConfig()` function validation.

## 3. Update Transformer

If the new config affects LHCI, update `transformConfig()` to map your new field to the `LighthouseRc` structure.

## 4. Update Example normrc.json

Update the root `normrc.json` file to demonstrate the new option.

## 5. Update README

If it's a user-facing option, document it in `README.md` under the configuration examples.

## 6. Verify
// turbo-all
```bash
pnpm type-check
pnpm lint
pnpm build
```

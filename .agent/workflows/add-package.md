---
description: How to add a new package to the wapmetrics monorepo
---

# Adding a New Package Workflow

## 1. Create Package Directory

```bash
mkdir -p packages/<package-name>/src
```

## 2. Create package.json

Create `packages/<package-name>/package.json`:

```json
{
  "name": "@wapmetrics/<package-name>",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.9.3",
    "@types/node": "^20"
  }
}
```

## 3. Create tsconfig.json

Create `packages/<package-name>/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## 4. Create Entry Point

Create `packages/<package-name>/src/index.ts` with exports.

## 5. Install Dependencies
// turbo
```bash
pnpm install
```

## 6. Verify
// turbo-all
```bash
pnpm type-check
pnpm build
```

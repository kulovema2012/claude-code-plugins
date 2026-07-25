---
name: monorepo-manager
description: Manage and migrate projects to a Monorepo structure using Bun Workspaces. Use when reorganizing a single-repo into apps/ and packages/ directories to improve modularity and code sharing.
---

# Monorepo Manager

This skill provides workflows and tools for managing a **Bun Workspaces** monorepo. It focuses on the "Apps/Packages" pattern, separating deployable applications from reusable libraries.

## Core Workflow: Migrating to a Monorepo

Follow these steps to transition a standard project into a clean monorepo:

### 1. Structure Design
The goal is to move the project to this hierarchy:
- `apps/`: Deployable applications (Next.js, Vite, etc.)
- `packages/`: Internal libraries and shared tools (Types, Utils, Configs)
- Root: Only workspace-level configuration.

### 2. Initialization
Create the directory structure and the root `package.json`.
You can use the bundled script:
```bash
node ./scripts/migrate_to_monorepo.cjs --init
```

### 3. File Migration
Move files into their new boundaries. 
- Main app -> `apps/web`
- Shared logic -> `packages/shared`
- Generic tools -> `packages/<tool-name>`

### 4. Configuration Update
- **Workspaces:** Define `"workspaces": ["apps/*", "packages/*"]` in root `package.json`.
- **Proxy Scripts:** Add root scripts that filter to the sub-packages (e.g., `"dev": "bun run --filter web dev"`).
- **Paths:** Update `tsconfig.json` paths to point to the new package locations (e.g., `"@shared/*": ["../../packages/shared/src/*"]`).

## Best Practices
- **Single Lockfile:** Always run `bun install` from the root to maintain a single `bun.lock`.
- **Private Packages:** Set `"private": true` in the `package.json` of internal packages unless you intend to publish them to NPM.
- **Shared Types:** Create a `@saifah/shared` (or similar) package for TypeScript interfaces used across both the app and external tools.

## Reference Material
- See [references/bun-workspaces.md](references/bun-workspaces.md) for detailed configuration snippets.

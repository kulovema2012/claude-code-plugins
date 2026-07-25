# Bun Workspaces Configuration

## Root `package.json` Template
```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "bun run --filter web dev",
    "build": "bun run --filter web build",
    "db:migrate": "bun run --filter web db:migrate"
  }
}
```

## Shared Package `package.json`
```json
{
  "name": "@my-org/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

## Consuming Shared Packages
In your application's `package.json`:
```json
"dependencies": {
  "@my-org/shared": "workspace:*"
}
```

## TypeScript Configuration
Update `tsconfig.json` in the app to resolve the shared package during development:
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../../packages/shared/src/*"]
    }
  }
}
```

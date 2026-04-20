---
name: boilerplate-references
version: 1.0.0
description: >
  Parameter lookup tables for the project-boilerplate generator. Loaded by init-boilerplate during
  Phase 2 (resolve parameters). Contains package manager commands, test framework details, logger
  configs, gitignore patterns, directory structures, domain paths, architectural patterns, and
  plugin recommendations. Do NOT invoke directly — always use via init-boilerplate.
---

# Boilerplate Parameter References

Lookup tables for resolving template variables based on user's stack answers.

---

## Package Manager Commands

### bun (TypeScript)

| Action | Command | Never Use |
|--------|---------|-----------|
| Install dependency | `bun add <pkg>` | npm, yarn, pnpm |
| Run dev server | `bun run dev` | npx, npm run |
| Run tests | `bun test` | npm test |
| Run scripts | `bun run <script>` | npm run |
| Execute binaries | `bunx <cmd>` | npx |
| Type check | `bun run check` | npx tsc |

Commands substitution:
- `{{test_command}}` → `bun test`
- `{{lint_command}}` → `bunx eslint .`
- `{{format_command}}` → `bun run format`

### npm / pnpm / yarn

| Action | Command | Never Use |
|--------|---------|-----------|
| Install dependency | `npm install <pkg>` / `pnpm add <pkg>` | - |
| Run dev server | `npm run dev` | - |
| Run tests | `npm test` | - |
| Run scripts | `npm run <script>` | - |
| Execute binaries | `npx <cmd>` | - |

Commands substitution:
- `{{test_command}}` → `npm test`
- `{{lint_command}}` → `npx eslint .`
- `{{format_command}}` → `npm run format`

### uv (Python)

| Action | Command | Never Use |
|--------|---------|-----------|
| Install dependency | `uv add <pkg>` | pip, poetry, pipenv |
| Run scripts | `uv run <script>` | python directly |
| Run tests | `uv run pytest` | pip, pytest directly |
| Create venv | `uv venv` | python -m venv |
| Run linting | `uvx ruff check` | pip install ruff |

Commands substitution:
- `{{test_command}}` → `uv run pytest`
- `{{lint_command}}` → `uvx ruff check`
- `{{format_command}}` → `uvx ruff format`

---

## Test Framework Details

### Vitest + Playwright

| Tool | Config | What It Tests |
|------|--------|---------------|
| Vitest | `vitest.config.ts` | Unit tests — actions, utilities, queries |
| Playwright | `playwright.config.ts` | E2E tests — full user flows |
| TypeScript | `tsconfig.json` | Type checking via `bun run check` |

| Command | Purpose |
|---------|---------|
| `bun test` | Run all unit tests |
| `bun run check` | TypeScript type-check |
| `bunx playwright test` | Run E2E test suite |

A.A.A. example (TypeScript):
```typescript
// Arrange — set up the test state
const input = { userId: 1, businessId: 2 };
mockDb.getUserById.mockResolvedValue(mockUser);

// Act — execute the unit under test
const result = await getBusinessDashboard(input);

// Assert — verify the expected outcome
expect(result.businesses).toHaveLength(1);
expect(result.businesses[0].companyName).toBe("Acme Corp");
```

### pytest

| Tool | Config | What It Tests |
|------|--------|---------------|
| pytest | `pyproject.toml` or `pytest.ini` | Unit + integration tests |

| Command | Purpose |
|---------|---------|
| `uv run pytest` | Run all tests |
| `uv run pytest tests/test_file.py -v` | Run specific test file |
| `uv run pytest -x` | Stop on first failure |

A.A.A. example (Python):
```python
# Arrange — set up the test state
input_data = {"user_id": 1, "business_id": 2}
mock_db.get_user_by_id.return_value = mock_user

# Act — execute the unit under test
result = await get_business_dashboard(input_data)

# Assert — verify the expected outcome
assert len(result["businesses"]) == 1
assert result["businesses"][0]["company_name"] == "Acme Corp"
```

---

## Logger Details

### Pino (TypeScript)

```typescript
import { logError, logInfo } from "@/lib/logger";

logInfo("Operation completed", { userId: 42, count: 5 });
logError(error, { action: "createRecord", userId: session.user.id });
```

| Level | When to Use |
|-------|-------------|
| `fatal` | App cannot continue (DB down, auth failure) |
| `error` | Operation failed but app continues |
| `warn` | Unexpected but handled |
| `info` | Business events (user signed in, record created) |
| `debug` | Development diagnostics |
| `trace` | Very verbose (request/response bodies) |

### structlog (Python)

```python
import structlog

logger = structlog.get_logger()

logger.info("operation_completed", user_id=42, count=5)
logger.error("operation_failed", action="create_record", error=str(e))
```

| Level | When to Use |
|-------|-------------|
| `critical` | App cannot continue |
| `error` | Operation failed but app continues |
| `warning` | Unexpected but handled |
| `info` | Business events |
| `debug` | Development diagnostics |

---

## Gitignore Patterns

### TypeScript / Web
- `node_modules/`, `.bun/`, `.next/`, `out/`, `dist/`
- `.env`, `.env.local`, `.env.*.local`
- `.vscode/`, `.idea/`
- `test-results/`, `playwright-report/`

### Python / Data Science
- `__pycache__/`, `*.pyc`, `.venv/`, `*.egg-info/`
- `.env`, `.env.local`
- `.ipynb_checkpoints/`, `.mypy_cache/`
- `notebooks/outputs/`, `data/raw/`

### Universal (always include)
- `.claude/`, `CLAUDE.md` (AI materials)
- `.DS_Store`, `Thumbs.db`

---

## Directory Structures by Framework

### Next.js App Router
```
src/
├── app/              # Routes (App Router)
│   ├── (dashboard)/  # Protected routes
│   └── api/          # API routes
├── components/       # React components
│   ├── ui/           # Shadcn/primitives
│   └── ...           # Business components
├── lib/              # Server logic
│   ├── actions/      # Server actions
│   ├── db/           # Database queries
│   └── utils.ts      # Utilities
├── drizzle/          # Schema + migrations
└── tests/            # Test files
```

Architectural patterns:
- Server Components by default — only add `"use client"` when needed
- Server Actions for mutations — all mutations through `lib/actions/*.ts`
- Drizzle/Prisma for database — schema in `drizzle/`, queries in `lib/db/`
- Component co-location — business components in `components/`, primitives via Shadcn

Feature workflow:
1. Add schema to `drizzle/schema.ts` if new tables needed
2. Generate migration: `bun run db:generate`
3. Add query functions to `lib/db/queries.ts`
4. Create server action in `lib/actions/<domain>.ts`
5. Create page in `app/(dashboard)/<feature>/page.tsx`
6. Add components in `components/` or co-locate with page
7. Write tests in `tests/`

### React Native
```
src/
├── screens/          # Screen components
├── components/       # Reusable UI
├── services/         # API calls, auth
├── hooks/            # Custom hooks
├── navigation/       # Router config
├── store/            # State management
├── utils/            # Utilities
└── __tests__/        # Test files
```

Architectural patterns:
- One screen per file in `src/screens/`
- Navigation centralized in `src/navigation/`
- State management via Zustand/Redux in `src/store/`
- API calls isolated in `src/services/`

Feature workflow:
1. Create screen in `src/screens/<Feature>Screen.tsx`
2. Add navigation route in `src/navigation/`
3. Create service in `src/services/<feature>.ts`
4. Add state slice in `src/store/` if needed
5. Write tests in `src/__tests__/`

### Python / Data Science
```
src/
├── data/             # Data pipelines
├── features/         # Feature engineering
├── models/           # ML models
├── visualization/    # Plots and charts
├── utils/            # Utilities
notebooks/            # Jupyter notebooks
tests/                # Test files
pyproject.toml        # Project config
```

Architectural patterns:
- One module per concern in `src/`
- Notebooks for exploration only — production code in `src/`
- Configuration via `pyproject.toml` and environment variables
- Data versioning with DVC or similar

Feature workflow:
1. Create module in `src/<domain>/`
2. Add configuration to `pyproject.toml` if needed
3. Write exploration notebook in `notebooks/`
4. Move production logic to `src/`
5. Write tests in `tests/`

### FastAPI
```
app/
├── api/              # Route definitions
│   └── v1/           # API versioning
├── core/             # Config, security
├── models/           # Database models
├── schemas/          # Pydantic schemas
├── services/         # Business logic
├── db/               # Database setup
tests/
pyproject.toml
```

Architectural patterns:
- API versioning under `app/api/v1/`
- Pydantic schemas for request/response validation
- SQLAlchemy models in `app/models/`
- Dependency injection for DB sessions and auth

Feature workflow:
1. Create model in `app/models/<domain>.py`
2. Create schema in `app/schemas/<domain>.py`
3. Create service in `app/services/<domain>.py`
4. Create route in `app/api/v1/<domain>.py`
5. Register router in `app/api/v1/__init__.py`
6. Write tests in `tests/`

---

## Domain Paths by Framework

### Next.js
```
| **UI/Frontend** | `app/*/page.tsx`, `components/**` | Read component files, Edit for changes |
| **Server Actions** | `lib/actions/*.ts` | Read actions + queries, Edit for logic |
| **Database** | `drizzle/schema.ts`, `lib/db/*` | Read schema, Edit schema |
| **Auth/Security** | `lib/auth/*`, `middleware.ts` | Read auth config |
| **API Routes** | `app/api/*/route.ts` | Read route handlers |
```

### React Native
```
| **Screens** | `src/screens/**` | Read screen components |
| **Services** | `src/services/**` | Read API/auth services |
| **Navigation** | `src/navigation/**` | Read router config |
| **State** | `src/store/**` | Read state management |
| **Components** | `src/components/**` | Read reusable UI |
```

### Python / Data Science
```
| **Data Pipeline** | `src/data/**` | Read data processing |
| **Features** | `src/features/**` | Read feature engineering |
| **Models** | `src/models/**` | Read ML models |
| **Visualization** | `src/visualization/**` | Read plots/charts |
| **Notebooks** | `notebooks/**` | Read Jupyter notebooks |
```

### FastAPI
```
| **API Routes** | `app/api/**/*.py` | Read route definitions |
| **Models** | `app/models/*.py` | Read database models |
| **Schemas** | `app/schemas/*.py` | Read Pydantic schemas |
| **Services** | `app/services/*.py` | Read business logic |
| **Database** | `app/db/*.py` | Read DB setup/queries |
```

---

## Plugin Recommendations by Project Type

### Web Application
```json
{
  "enabledPlugins": {
    "unit-testing@claude-code-workflows": true,
    "frontend-design@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true,
    "typescript-lsp@claude-plugins-official": true,
    "pr-review-toolkit@claude-plugins-official": true,
    "agent-teams@claude-code-workflows": true
  }
}
```

### Mobile Application
```json
{
  "enabledPlugins": {
    "unit-testing@claude-code-workflows": true,
    "frontend-design@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true,
    "typescript-lsp@claude-plugins-official": true,
    "pr-review-toolkit@claude-plugins-official": true,
    "agent-teams@claude-code-workflows": true
  }
}
```

### Data Science / ML
```json
{
  "enabledPlugins": {
    "unit-testing@claude-code-workflows": true,
    "feature-dev@claude-plugins-official": true,
    "agent-teams@claude-code-workflows": true
  }
}
```

### Backend / API
```json
{
  "enabledPlugins": {
    "unit-testing@claude-code-workflows": true,
    "feature-dev@claude-plugins-official": true,
    "pr-review-toolkit@claude-plugins-official": true,
    "agent-teams@claude-code-workflows": true
  }
}
```

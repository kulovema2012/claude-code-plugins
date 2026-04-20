---
name: init-boilerplate
version: 1.0.0
description: >
  Generate a complete AI coding tooling layer for a new project. Invoke when the user wants to
  set up CLAUDE.md, rules, skills catalogs, agent catalogs, and plugin settings for a new or
  existing project. Triggers on: "init boilerplate", "set up project", "new project setup",
  "generate claude config", "scaffold AI tools", "/init-boilerplate". Also use when starting
  work in a new repo that has no CLAUDE.md or .claude/ directory.
---

# Project Boilerplate Generator

Generate a modular AI coding tooling layer tailored to your project's stack. This skill creates:

- **CLAUDE.md** — Concise root config (~80 lines) with `@` imports to rule files
- **6 parameterized rule files** — Environment, testing, observability, git, tool selection, project org
- **2 auto-generated catalogs** — Skills catalog and agents catalog
- **Plugin settings** — `.claude/settings.json` with recommended plugins
- **Bundled skill** — `engineering-mentor` copied into the project

## Phase 1: Ask Stack Questions

Ask these 7 questions using AskUserQuestion (batch up to 4 per call). Store answers as variables for template generation.

**Question 1 — Project type:**
```
question: "What type of project are you setting up?"
options:
  - label: "Web Application"
    description: "Next.js, React, Vue, Svelte, Angular, Remix, Astro"
  - label: "Mobile Application"
    description: "React Native, Flutter, Swift, Kotlin"
  - label: "Data Science / ML"
    description: "Jupyter, pandas, PyTorch, TensorFlow, scikit-learn"
  - label: "Backend / API"
    description: "FastAPI, Django, Express, NestJS, Go, Spring Boot"
```

**Question 2 — Framework (dynamic based on project type):**

If Web:
```
options:
  - label: "Next.js"
  - label: "Remix"
  - label: "Astro"
  - label: "Other"
```

If Mobile:
```
options:
  - label: "React Native"
  - label: "Flutter"
  - label: "Native (Swift/Kotlin)"
  - label: "Other"
```

If Data Science/ML:
```
options:
  - label: "Jupyter + Python"
  - label: "Python scripts"
  - label: "R"
  - label: "Other"
```

If Backend/API:
```
options:
  - label: "FastAPI"
  - label: "Django"
  - label: "Express / NestJS"
  - label: "Go"
  - label: "Other"
```

**Question 3 — Primary language:**
```
options:
  - label: "TypeScript"
  - label: "Python"
  - label: "Go"
  - label: "Other"
```

**Question 4 — Package manager:**
```
options:
  - label: "bun (Recommended for TS)"
  - label: "npm / pnpm / yarn"
  - label: "uv (Recommended for Python)"
  - label: "pip / poetry"
  - label: "Other"
```

**Question 5 — Database:**
```
options:
  - label: "PostgreSQL"
  - label: "MySQL"
  - label: "MongoDB"
  - label: "SQLite"
  - label: "None"
```

**Question 6 — Testing framework:**
```
options:
  - label: "Vitest + Playwright"
  - label: "Jest"
  - label: "pytest"
  - label: "Go test"
  - label: "None yet"
```

**Question 7 — Deploy target:**
```
options:
  - label: "Vercel"
  - label: "Cloudflare"
  - label: "Docker"
  - label: "AWS / GCP / Azure"
  - label: "Self-hosted"
  - label: "None yet"
```

## Phase 2: Generate Files

After collecting all answers, generate each file using the Write tool. Use the parameter tables below to fill in stack-specific values.

---

## Parameter Reference Tables

### Package Manager Commands

**bun (TypeScript):**
| Action | Command | Never Use |
|--------|---------|-----------|
| Install dependency | `bun add <pkg>` | npm, yarn, pnpm |
| Run dev server | `bun run dev` | npx, npm run |
| Run tests | `bun test` | npm test |
| Run scripts | `bun run <script>` | npm run |
| Execute binaries | `bunx <cmd>` | npx |
| Type check | `bun run check` | npx tsc |

**npm/pnpm/yarn:**
| Action | Command | Never Use |
|--------|---------|-----------|
| Install dependency | `npm install <pkg>` / `pnpm add <pkg>` | - |
| Run dev server | `npm run dev` | - |
| Run tests | `npm test` | - |
| Run scripts | `npm run <script>` | - |
| Execute binaries | `npx <cmd>` | - |

**uv (Python):**
| Action | Command | Never Use |
|--------|---------|-----------|
| Install dependency | `uv add <pkg>` | pip, poetry, pipenv |
| Run scripts | `uv run <script>` | python directly |
| Run tests | `uv run pytest` | pip, pytest directly |
| Create venv | `uv venv` | python -m venv |
| Run linting | `uvx ruff check` | pip install ruff |

### Test Framework Details

**Vitest + Playwright:**
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

**pytest:**
| Tool | Config | What It Tests |
|------|--------|---------------|
| pytest | `pyproject.toml` or `pytest.ini` | Unit + integration tests |

| Command | Purpose |
|---------|---------|
| `uv run pytest` | Run all tests |
| `uv run pytest tests/test_file.py -v` | Run specific test file |
| `uv run pytest -x` | Stop on first failure |

### Logger Details

**Pino (TypeScript):**
```typescript
import { logError, logInfo } from "@/lib/logger";

logInfo("Operation completed", { userId: 42, count: 5 });
logError(error, { action: "createRecord", userId: session.user.id });
```

Levels: fatal, error, warn, info, debug, trace

**structlog (Python):**
```python
import structlog

logger = structlog.get_logger()

logger.info("operation_completed", user_id=42, count=5)
logger.error("operation_failed", action="create_record", error=str(e))
```

Levels: critical, error, warning, info, debug

### Gitignore Patterns by Stack

**TypeScript/Web:**
- `node_modules/`, `.bun/`, `.next/`, `out/`, `dist/`
- `.env`, `.env.local`, `.env.*.local`
- `.vscode/`, `.idea/`
- `test-results/`, `playwright-report/`

**Python/Data Science:**
- `__pycache__/`, `*.pyc`, `.venv/`, `*.egg-info/`
- `.env`, `.env.local`
- `.ipynb_checkpoints/`, `.mypy_cache/`
- `notebooks/outputs/`, `data/raw/`

**Universal (always include):**
- `.claude/`, `CLAUDE.md` (AI materials)
- `.DS_Store`, `Thumbs.db`

### Directory Structures by Framework

**Next.js App Router:**
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

**React Native:**
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

**Python / Data Science:**
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

**FastAPI:**
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

### Plugin Recommendations by Project Type

**Web Application:**
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

**Mobile Application:**
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

**Data Science / ML:**
```json
{
  "enabledPlugins": {
    "unit-testing@claude-code-workflows": true,
    "feature-dev@claude-plugins-official": true,
    "agent-teams@claude-code-workflows": true
  }
}
```

**Backend / API:**
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

---

## Phase 3: Template Sections for Each Generated File

Use the Write tool to create each file below. Substitute `{{variable}}` placeholders with the user's answers.

### File 1: `CLAUDE.md`

```markdown
# {{project_name}} — Project Configuration

## Role
Principal Software Engineer. Write clean, optimal, production-ready code. Prioritize maintainability, observability, and atomic architecture.

## Codebase Structure
See `@apt/codebase-structure.md` for the full project map, tech stack, directory layout, schema, and data flows.

---

## Rules

All rules in `.claude/rules/` — invoked automatically by path matching or topic:

| Rule | File | When It Applies |
|------|------|----------------|
| Environment & Isolation | `@.claude/rules/environment-isolation.md` | Setup, dependencies, .env |
| Testing (A.A.A.) | `@.claude/rules/testing-aaa.md` | Unit tests, business logic |
| Observability | `@.claude/rules/observability.md` | Logging, error handling |
| Git Workflow | `@.claude/rules/git-workflow.md` | Committing, pushing |
| Tool & Agent Selection | `@.claude/rules/tool-selection.md` | Delegating, choosing tools |
| Project Organization | `@.claude/rules/project-organization.md` | Organizing code, rules |
| **Skills Catalog** | `@.claude/rules/skills-catalog.md` | All available skills by plugin |
| **Agents Catalog** | `@.claude/rules/agents-catalog.md` | All available agents by domain |

---

## Skills — Quick Reference

> Full catalog: `@.claude/rules/skills-catalog.md`

**Always invoke BEFORE any response:**

| Task Type | Skill |
|-----------|-------|
| Creating features/components | `superpowers:brainstorming` → domain skill |
| Bug fixes / unexpected behavior | `superpowers:systematic-debugging` |
| Multi-step implementation | `superpowers:writing-plans` |
| Executing an existing plan | `superpowers:executing-plans` |
| Before claiming work done | `superpowers:verification-before-completion` |
| New features or bugfixes | `superpowers:test-driven-development` |
| 2+ independent tasks in parallel | `superpowers:dispatching-parallel-agents` |

---

## Agents — Quick Reference

> Full catalog: `@.claude/rules/agents-catalog.md`

| Category | Key Agents |
|----------|------------|
| **Explore & Plan** | `Explore`, `Plan` |
| **Frontend** | `application-performance:frontend-developer` |
| **Backend** | `api-scaffolding:backend-architect` |
| **Database** | `database-design:database-architect` |
| **Quality** | `comprehensive-review:full-review` |
| **Teams** | `agent-teams:team-lead`, `agent-teams:team-implementer` |
| **General** | `general-purpose` |

---

## Agent-Team Dispatch Rules

**REQUIRED** when: 3+ distinct tasks, multi-file changes, or parallel workstreams.

Workflow:
1. `superpowers:brainstorming` → identify subtasks
2. `superpowers:dispatching-parallel-agents` → split into parallel work
3. `agent-teams:team-spawn` → dispatch team
4. Monitor via `agent-teams:team-status`; shut down via `agent-teams:team-shutdown`

---

## Key Commands

{{commands_table}}

## Response Format

- Think step-by-step. Briefly explain the **Why** before providing code.
- Prioritize the single most optimal, efficient, and accurate solution.
- Format all code in clear markdown blocks with file names included.
```

The `{{commands_table}}` placeholder gets replaced with the appropriate command table from the Package Manager Commands section above.

### File 2: `.claude/rules/environment-isolation.md`

Generate using the parameter tables. Structure:

```markdown
---
name: environment-isolation
description: Rules for environment setup, gitignore, worktree isolation, package management, and .env strategy
type: rule
---

# Environment & Isolation

## Gitignore First
Before generating any project code, ensure these are in `.gitignore`:
{{gitignore_patterns_from_table}}

## Task Isolation
Every new feature or bugfix is executed in an isolated git worktree. Do not write code that breaks `main`. If a change touches shared code, ensure backward compatibility.

## Strict Package Management
This project uses **{{package_manager}}**.

| Action | Command | Never Use |
|--------|---------|-----------|
{{package_manager_commands_from_table}}

## Environment Variables
{{env_var_section}}
```

### File 3: `.claude/rules/testing-aaa.md`

```markdown
---
name: testing-aaa
description: Test-driven development standards with {{test_framework}} and Arrange-Act-Assert framework
type: rule
---

# Implementation & Testing

## Code Standards
- Write modular, single-responsibility functions.
- For every piece of business logic, write the unit test alongside it.

## A.A.A. Standard (Arrange-Act-Assert)
All unit tests must explicitly follow this structure:

{{aaa_example_in_language}}

## Test Tools in This Project

{{test_tools_table_from_parameter_table}}

## Running Tests

{{test_commands_table}}

## When to Write Tests
- **Must test:** Business logic, data queries, utility functions
- **Should test:** Complex components with state logic
- **Skip testing:** Pure type definitions, simple wrappers
```

### File 4: `.claude/rules/observability.md`

```markdown
---
name: observability
description: Structured logging standards using {{logger}}, error handling patterns, and monitoring conventions
type: rule
---

# Observability

## No Console Logs in Production
Never leave raw `console.log()`, `print()`, or `console.error()` in production code. They lack structure, traceability, and are invisible in production monitoring.

## Project Logger: {{logger_name}}
This project uses **{{logger_name}}** for structured logging.

{{logger_usage_examples}}

### Log Levels
{{log_levels_table}}

## Context Tags
Always include relevant IDs in logs for traceability:

{{context_tags_example}}

## Where to Log
- **Business logic:** Log errors at action boundaries, not inside every helper.
- **API endpoints:** Log incoming requests and error responses.
- **Background jobs:** Log start/end with duration and records processed.
- **Middleware:** Avoid logging here — it runs on every request. Only log auth failures.

## Monitoring Stack (Production Target)
- **Loki** — Log aggregation
- **Grafana** — Dashboards and alerting
- **Tempo** — Distributed tracing
- **Prometheus** — Metrics collection
```

### File 5: `.claude/rules/git-workflow.md`

This file is UNIVERSAL — same content regardless of stack:

```markdown
---
name: git-workflow
description: Atomic commit-push workflow, gitmoji commit format, branching strategy
type: rule
---

# Version Control (Atomic Deliverables)

## Atomic Unit Principle
Break solutions into atomic units — each commit represents one logical, indivisible change.

## STRICT ATOMIC PUSHING

```
Change → Test → Lint → Stage → Commit → Push → Next
```

1. Make ONE logical change
2. Run tests: `{{test_command}}`
3. Lint: `{{lint_command}}`
4. Format: `{{format_command}}`
5. Stage files: `git add <specific-files>` (never `git add .` or `git add -A`)
6. Commit with gitmoji prefix
7. Push immediately: `git push`
8. ONLY THEN move to next task

## Violations (NEVER)
- Making multiple changes before pushing
- "I'll push after this other fix"
- Batch commits with unrelated changes
- Leaving uncommitted work at session end

## Commit Message Format (Gitmoji + Scope)

Every commit MUST use this format:
```
<emoji> <type>(<scope>): <description>
```

| Emoji | Type | Usage | Example |
|-------|------|-------|---------|
| ✨ | feat(scope) | New feature | `✨ feat(auth): add password hashing` |
| 🐛 | fix(scope) | Bug fix | `🐛 fix(auth): redirect correctly` |
| ♻️ | refactor(scope) | No behavior change | `♻️ refactor(queries): simplify patterns` |
| 📝 | docs | Documentation | `📝 docs: update API documentation` |
| ✅ | test(scope) | Tests | `✅ test(auth): add login tests` |
| 🔧 | chore | Maintenance | `🔧 chore: upgrade dependencies` |
| ⚡ | perf | Performance | `⚡ perf(queries): add index` |
| 🎨 | style | Formatting | `🎨 style: format with prettier` |
| 🧪 | experiment | Experiments | `🧪 experiment: try new approach` |

## Branch Naming
- Feature: `feat/<short-description>`
- Bugfix: `fix/<short-description>`
- No commits directly to `main` for large features — use a branch + PR.
```

### File 6: `.claude/rules/tool-selection.md`

```markdown
---
name: tool-selection
description: Skills, agents, and tool selection guide with project-specific domain mapping
type: rule
---

# Tool & Agent Orchestration

## Task Triage — Domain Mapping

| Domain | Key Paths | Primary Tools |
|--------|-----------|---------------|
{{domain_paths_table}}

## Skills — Invoke BEFORE Any Response

> Full catalog: `@.claude/rules/skills-catalog.md`

| Task Type | Skill to Invoke First |
|-----------|----------------------|
| Creating features/components | `superpowers:brainstorming` |
| Bug fixes / unexpected behavior | `superpowers:systematic-debugging` |
| Multi-step implementation plan | `superpowers:writing-plans` |
| Executing an existing plan | `superpowers:executing-plans` |
| Before claiming work done | `superpowers:verification-before-completion` |
| New features or bugfixes (code) | `superpowers:test-driven-development` |
| 2+ independent tasks in parallel | `superpowers:dispatching-parallel-agents` |

## Agents — Select by Domain

> Full catalog: `@.claude/rules/agents-catalog.md`

| Agent Type | When to Use |
|------------|-------------|
| `Explore` | Codebase exploration, finding files |
| `Plan` | Implementation strategies, architectural decisions |
| `general-purpose` | Complex multi-step research |
| `agent-teams` | 3+ tasks, multi-file features, parallel workstreams |

## Agent-Team Dispatch Rules

**REQUIRED** when: 3+ distinct tasks, multi-file changes, or parallel workstreams.

Workflow:
1. `superpowers:brainstorming` → identify all subtasks
2. `superpowers:dispatching-parallel-agents` → split into parallel work
3. `agent-teams:team-spawn` → dispatch team
4. Monitor via `agent-teams:team-status`
5. Shut down via `agent-teams:team-shutdown`

## Assume Nothing
If a required tool or context is missing, halt and ask. Never guess at API signatures, env var names, or database column types — read the actual files first.

## Priority Order
1. Process skills first (brainstorming, debugging) — determine HOW to approach
2. If 3+ tasks → dispatch agent-team before any implementation
3. Implementation skills second — guide execution
```

### File 7: `.claude/rules/project-organization.md`

```markdown
---
name: project-organization
description: Project file structure conventions, architectural patterns, and CLAUDE.md scaling rules
type: rule
---

# Project Organization

## Directory Structure

{{directory_structure_from_parameter_table}}

## Architectural Patterns

{{architectural_patterns_per_framework}}

## CLAUDE.md Scaling
- Keep CLAUDE.md under 200 lines
- Split detailed rules into `.claude/rules/` — one topic per file
- Use `@path` imports to reference rule files from CLAUDE.md
- All `.md` files in `.claude/` are discovered recursively

## Path-Specific Rules

Scope rules to file paths using YAML frontmatter:

```yaml
---
paths:
  - "src/api/**/*.ts"
---
```

## Adding New Features

{{feature_workflow_per_framework}}
```

### File 8: `.claude/rules/skills-catalog.md`

This file is AUTO-GENERATED. Instruct the skill to:

1. Scan all available skills from the current session (they appear in the system prompt's available skills list)
2. Organize them by plugin group
3. Output in the same table format as the saifah-fund `skills-catalog.md`

The SKILL.md should include the FULL skills catalog content from the saifah-fund project as a default, since those are the standard installed plugins. The skill should instruct Claude to use this as a base and update it based on the user's project type (e.g., add data-engineering skills for data science projects, add vercel skills for web projects).

Use the complete content from the saifah-fund `skills-catalog.md` (already captured in the spec exploration).

### File 9: `.claude/rules/agents-catalog.md`

Same approach as skills-catalog.md — use the complete content from the saifah-fund `agents-catalog.md` as the default catalog. This is universal across all projects since it lists all available agent types.

Use the complete content from the saifah-fund `agents-catalog.md` (already captured in the spec exploration).

### File 10: `.claude/settings.json`

Use the Plugin Recommendations table above to select the right `enabledPlugins` object based on the user's project type answer.

### File 11: `.claude/skills/engineering-mentor/SKILL.md`

Copy the exact content from `engineering-mentor/skills/engineering-mentor/SKILL.md` in this plugin repository. This is a universal skill that works in any project.

---

## Generation Instructions

When executing this skill, follow this exact order:

1. **Ask all 7 questions** (use AskUserQuestion, batch up to 4 per call)
2. **Collect answers** into variables: `project_type`, `framework`, `language`, `pkg_manager`, `database`, `test_framework`, `deploy_target`
3. **Create `.claude/` directory structure** using Bash: `mkdir -p .claude/rules .claude/skills/engineering-mentor`
4. **Generate File 1** — CLAUDE.md (substitute `{{commands_table}}` from parameter tables)
5. **Generate File 2** — environment-isolation.md (substitute from parameter tables)
6. **Generate File 3** — testing-aaa.md (substitute from parameter tables)
7. **Generate File 4** — observability.md (substitute from parameter tables)
8. **Generate File 5** — git-workflow.md (substitute `{{test_command}}`, `{{lint_command}}`, `{{format_command}}`)
9. **Generate File 6** — tool-selection.md (substitute domain paths from parameter tables)
10. **Generate File 7** — project-organization.md (substitute from parameter tables)
11. **Generate File 8** — skills-catalog.md (use full catalog, adjust by project type)
12. **Generate File 9** — agents-catalog.md (use full catalog as-is)
13. **Generate File 10** — settings.json (select from plugin recommendations table)
14. **Generate File 11** — engineering-mentor/SKILL.md (copy from this plugin)
15. **Print summary** of all generated files

### Command Substitutions by Package Manager

**bun:**
- `{{test_command}}` → `bun test`
- `{{lint_command}}` → `bunx eslint .` (TS) or `bunx biome check .`
- `{{format_command}}` → `bun run format`

**npm/pnpm:**
- `{{test_command}}` → `npm test`
- `{{lint_command}}` → `npx eslint .`
- `{{format_command}}` → `npm run format`

**uv:**
- `{{test_command}}` → `uv run pytest`
- `{{lint_command}}` → `uvx ruff check`
- `{{format_command}}` → `uvx ruff format`

### Domain Paths Substitutions by Framework

**Next.js:**
```
| **UI/Frontend** | `app/*/page.tsx`, `components/**` | Read component files, Edit for changes |
| **Server Actions** | `lib/actions/*.ts` | Read actions + queries, Edit for logic |
| **Database** | `drizzle/schema.ts`, `lib/db/*` | Read schema, Edit schema |
| **Auth/Security** | `lib/auth/*`, `middleware.ts` | Read auth config |
| **API Routes** | `app/api/*/route.ts` | Read route handlers |
```

**React Native:**
```
| **Screens** | `src/screens/**` | Read screen components |
| **Services** | `src/services/**` | Read API/auth services |
| **Navigation** | `src/navigation/**` | Read router config |
| **State** | `src/store/**` | Read state management |
| **Components** | `src/components/**` | Read reusable UI |
```

**Python / Data Science:**
```
| **Data Pipeline** | `src/data/**` | Read data processing |
| **Features** | `src/features/**` | Read feature engineering |
| **Models** | `src/models/**` | Read ML models |
| **Visualization** | `src/visualization/**` | Read plots/charts |
| **Notebooks** | `notebooks/**` | Read Jupyter notebooks |
```

**FastAPI:**
```
| **API Routes** | `app/api/**/*.py` | Read route definitions |
| **Models** | `app/models/*.py` | Read database models |
| **Schemas** | `app/schemas/*.py` | Read Pydantic schemas |
| **Services** | `app/services/*.py` | Read business logic |
| **Database** | `app/db/*.py` | Read DB setup/queries |
```

### Architectural Patterns by Framework

**Next.js:**
- Server Components by default — only add `"use client"` when needed
- Server Actions for mutations — all mutations through `lib/actions/*.ts`
- Drizzle/Prisma for database — schema in `drizzle/`, queries in `lib/db/`
- Component co-location — business components in `components/`, primitives via Shadcn

**React Native:**
- One screen per file in `src/screens/`
- Navigation centralized in `src/navigation/`
- State management via Zustand/Redux in `src/store/`
- API calls isolated in `src/services/`

**Python / Data Science:**
- One module per concern in `src/`
- Notebooks for exploration only — production code in `src/`
- Configuration via `pyproject.toml` and environment variables
- Data versioning with DVC or similar

**FastAPI:**
- API versioning under `app/api/v1/`
- Pydantic schemas for request/response validation
- SQLAlchemy models in `app/models/`
- Dependency injection for DB sessions and auth

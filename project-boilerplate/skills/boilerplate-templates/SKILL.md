---
name: boilerplate-templates
version: 1.0.0
description: >
  File templates for the project-boilerplate generator. Loaded by init-boilerplate during Phase 3
  (file generation). Contains all template structures for CLAUDE.md, rule files, catalogs, and
  settings. Do NOT invoke directly — always use via init-boilerplate.
---

# Boilerplate File Templates

All templates use `{{variable}}` placeholders that get substituted with resolved values from `boilerplate-references`.

---

## File 1: CLAUDE.md

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

---

## File 2: environment-isolation.md

```markdown
---
name: environment-isolation
description: Rules for environment setup, gitignore, worktree isolation, package management, and .env strategy
type: rule
---

# Environment & Isolation

## Gitignore First
Before generating any project code, ensure these are in `.gitignore`:
{{gitignore_patterns}}

## Task Isolation
Every new feature or bugfix is executed in an isolated git worktree. Do not write code that breaks `main`. If a change touches shared code, ensure backward compatibility.

## Strict Package Management
This project uses **{{package_manager}}**.

| Action | Command | Never Use |
|--------|---------|-----------|
{{pkg_commands_table}}

## Environment Variables
{{env_var_section}}
```

---

## File 3: testing-aaa.md

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

{{aaa_example}}

## Test Tools in This Project

{{test_tools_table}}

## Running Tests

{{test_commands_table}}

## When to Write Tests
- **Must test:** Business logic, data queries, utility functions
- **Should test:** Complex components with state logic
- **Skip testing:** Pure type definitions, simple wrappers
```

---

## File 4: observability.md

```markdown
---
name: observability
description: Structured logging standards using {{logger_name}}, error handling patterns, and monitoring conventions
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

---

## File 5: git-workflow.md (UNIVERSAL — same regardless of stack)

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

---

## File 6: tool-selection.md

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

---

## File 7: project-organization.md

```markdown
---
name: project-organization
description: Project file structure conventions, architectural patterns, and CLAUDE.md scaling rules
type: rule
---

# Project Organization

## Directory Structure

{{dir_structure}}

## Architectural Patterns

{{arch_patterns}}

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

{{feature_workflow}}
```

---

## File 8: skills-catalog.md

AUTO-GENERATED — scan all available skills from the current session's system prompt. Organize by plugin group in table format:

```markdown
---
name: skills-catalog
description: Complete catalog of all available skills organized by plugin, with when-to-use guidance
type: rule
---

# Skills — Full Catalog

> Run `/skills` at any time to discover the latest available skills.

{{skills_catalog_by_plugin}}
```

---

## File 9: agents-catalog.md

AUTO-GENERATED — list all available agent types organized by domain:

```markdown
---
name: agents-catalog
description: Complete catalog of all available agent types organized by domain, with when-to-use guidance
type: rule
---

# Agents — Full Catalog

> Run `/agents` at any time to discover the latest available agent types.

{{agents_catalog_by_domain}}
```

---

## File 10: settings.json

Select from plugin recommendations based on project type:

```json
{{plugin_settings}}
```

---

## File 11: engineering-mentor/SKILL.md

Copy the exact content from `engineering-mentor/skills/engineering-mentor/SKILL.md` in the plugin repository.

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

Generate a modular AI coding tooling layer tailored to your project's stack.

**Output:** 11 files in the target project:
- `CLAUDE.md` — Concise root config (~80 lines) with `@` imports to rules
- `.claude/rules/environment-isolation.md` — Gitignore, package manager, env strategy
- `.claude/rules/testing-aaa.md` — Test framework, A.A.A. standard
- `.claude/rules/observability.md` — Logger, structured logging, monitoring
- `.claude/rules/git-workflow.md` — Atomic push, gitmoji commits
- `.claude/rules/tool-selection.md` — Skills/agents by domain, agent-team dispatch
- `.claude/rules/project-organization.md` — Directory structure, architectural patterns
- `.claude/rules/skills-catalog.md` — All installed skills by plugin
- `.claude/rules/agents-catalog.md` — All available agents by domain
- `.claude/settings.json` — Recommended plugins for the stack
- `.claude/skills/engineering-mentor/SKILL.md` — Bundled engineering mentor

## Sub-skills

This orchestrator delegates to two specialized skills:

| Skill | Purpose | When Loaded |
|-------|---------|-------------|
| `boilerplate-templates` | All file templates (CLAUDE.md, rules, catalogs, settings) | During file generation |
| `boilerplate-references` | Parameter lookup tables (pkg managers, frameworks, loggers, dirs) | During value resolution |

---

## Phase 1: Ask Stack Questions

Ask these 7 questions using AskUserQuestion (batch up to 4 per call). Store answers as variables.

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

**Question 2 — Framework (dynamic based on Q1):**

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

---

## Phase 2: Resolve Parameters

After collecting answers, invoke `boilerplate-references` skill to resolve all template variables:

1. Map answers to parameter values using the reference tables
2. Store resolved values: `pkg_commands`, `test_commands`, `logger_config`, `gitignore_patterns`, `dir_structure`, `domain_paths`, `arch_patterns`, `plugin_settings`, `commands_table`

---

## Phase 3: Generate Files

Create directory structure:
```bash
mkdir -p .claude/rules .claude/skills/engineering-mentor
```

Then invoke `boilerplate-templates` skill and generate files in this order:

1. `CLAUDE.md` — root config with `@` imports
2. `.claude/rules/environment-isolation.md` — gitignore + pkg manager + env
3. `.claude/rules/testing-aaa.md` — test framework + A.A.A. standard
4. `.claude/rules/observability.md` — logger + structured logging
5. `.claude/rules/git-workflow.md` — atomic push + gitmoji (only needs test/lint/format commands)
6. `.claude/rules/tool-selection.md` — domain paths + skills/agents tables
7. `.claude/rules/project-organization.md` — directory structure + architectural patterns
8. `.claude/rules/skills-catalog.md` — full skills catalog from templates
9. `.claude/rules/agents-catalog.md` — full agents catalog from templates
10. `.claude/settings.json` — plugin settings for the project type
11. `.claude/skills/engineering-mentor/SKILL.md` — copy from this plugin

---

## Phase 4: Summary

Print a summary of all generated files with their paths and line counts.

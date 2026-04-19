# Claude Code Plugins

Personal Claude Code plugin marketplace with skills and tools for AI-assisted development workflows.

## Install this marketplace

```bash
/plugin marketplace add kulovema2012/claude-code-plugins
```

## Available Plugins

### task-service

Skills for using the [task-service](https://github.com/kulovema2012/task-service) MCP tools — task management, session continuity, and decision logging across Claude Code sessions.

> **Requires external MCP server.** This plugin provides the skill that instructs Claude how to call `session_start`, `task_create`, `decision_log`, and related tools — but those tools are served by the [task-service MCP server](https://github.com/kulovema2012/task-service), which must be running and connected separately. See that repo for setup instructions.

```bash
/plugin install task-service@claude-code-plugins
```

**Included skills:**
- `task-service` — Session lifecycle, task creation/updates, and decision logging via MCP

---

### engineering-mentor

A proactive engineering mentor that activates during any technical decision — coding, system design, tool selection, architecture planning, and more. Interrupts when spotting bad habits or anti-patterns and gives clear best-practice recommendations.

```bash
/plugin install engineering-mentor@claude-code-plugins
```

**Included skills:**
- `engineering-mentor` — Best-practice guidance and anti-pattern detection for technical decisions

---

### project-boilerplate

Interactive AI tooling scaffolder — generates a complete CLAUDE.md, modular rules, skill/agent catalogs, and plugin settings tailored to your project's stack. Asks 7 questions about your tech stack and generates everything in one command.

```bash
/plugin install project-boilerplate@claude-code-plugins
```

**Included skills:**
- `init-boilerplate` — Interactive generator for project AI tooling (CLAUDE.md + rules + catalogs + settings)

**Supported project types:** Web, Mobile, Data Science/ML, Backend/API, Desktop

**What it generates:**
- `CLAUDE.md` — Concise root config with `@` imports
- `.claude/rules/` — 8 rule files (environment, testing, observability, git, tool-selection, project-org, skills-catalog, agents-catalog)
- `.claude/settings.json` — Recommended plugins for your stack
- `.claude/skills/engineering-mentor/` — Bundled engineering mentor skill

---

## Installation Options

### Option 1: Install from marketplace (recommended)

```bash
/plugin marketplace add kulovema2012/claude-code-plugins
/plugin install task-service@claude-code-plugins
/plugin install engineering-mentor@claude-code-plugins
```

### Option 2: Install from local directory (development)

Clone this repo and point Claude Code at the root directory:

```bash
git clone https://github.com/kulovema2012/claude-code-plugins.git
claude --plugin-dir ./claude-code-plugins
```

### Option 3: Install from ZIP

1. [Download the ZIP](https://github.com/kulovema2012/claude-code-plugins/archive/refs/heads/master.zip)
2. Extract and use `--plugin-dir` to load the plugin

---

## Plugin Structure

Follows the [official Claude Code plugin spec](https://code.claude.com/docs/en/plugins-reference) with a single root manifest:

```
claude-code-plugins/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── task-service/
│   └── skills/
│       └── task-service/
│           └── SKILL.md
├── engineering-mentor/
│   └── skills/
│       └── engineering-mentor/
│           └── SKILL.md
└── project-boilerplate/
    └── skills/
        └── project-boilerplate/
            └── SKILL.md
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide to adding new plugins.

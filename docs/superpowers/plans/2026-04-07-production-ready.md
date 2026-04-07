# Production-Ready Public Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the claude-code-plugins repo production-ready for public publishing under MIT license.

**Architecture:** Pure file operations — no build system, no dependencies, no tests. Each task produces a clean atomic commit. Tasks are independent and can be executed sequentially.

**Tech Stack:** Git, Markdown, JSON

---

## File Map

| Action | Path |
|--------|------|
| Delete | `task-service/.claude-plugin/plugin.json` |
| Delete | `task-service/.claude-plugin/` (dir) |
| Delete | `engineering-mentor/.claude-plugin/plugin.json` |
| Delete | `engineering-mentor/.claude-plugin/` (dir) |
| Modify | `plugin.json` |
| Modify | `task-service/plugin.json` |
| Modify | `engineering-mentor/plugin.json` |
| Create | `LICENSE` |
| Create | `CHANGELOG.md` |
| Create | `CONTRIBUTING.md` |
| Modify | `.gitignore` |
| Modify | `.claude/settings.json` |
| Modify | `README.md` |
| Modify | `CLAUDE.md` |

---

### Task 1: Remove duplicate plugin.json files

**Files:**
- Delete: `task-service/.claude-plugin/plugin.json`
- Delete: `task-service/.claude-plugin/` (directory)
- Delete: `engineering-mentor/.claude-plugin/plugin.json`
- Delete: `engineering-mentor/.claude-plugin/` (directory)

- [ ] **Step 1: Delete both `.claude-plugin` subdirectories**

```bash
rm -rf task-service/.claude-plugin
rm -rf engineering-mentor/.claude-plugin
```

- [ ] **Step 2: Verify root-level plugin.json files are intact**

```bash
cat task-service/plugin.json
cat engineering-mentor/plugin.json
```

Expected: both files print their JSON content without error.

- [ ] **Step 3: Verify directory tree**

```bash
find task-service engineering-mentor -type f
```

Expected output:
```
task-service/plugin.json
task-service/skills/task-service/SKILL.md
engineering-mentor/plugin.json
engineering-mentor/skills/engineering-mentor/SKILL.md
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "🔧 chore: remove duplicate .claude-plugin/plugin.json files"
```

---

### Task 2: Enrich plugin.json files with metadata

**Files:**
- Modify: `plugin.json`
- Modify: `task-service/plugin.json`
- Modify: `engineering-mentor/plugin.json`

- [ ] **Step 1: Replace root `plugin.json`**

Write the following content to `plugin.json`:

```json
{
  "name": "claude-code-plugins",
  "description": "Personal Claude Code plugin marketplace — skills and tools for AI-assisted development workflows.",
  "version": "1.0.0",
  "license": "MIT",
  "repository": "https://github.com/kulovema2012/claude-code-plugins",
  "keywords": ["claude-code", "plugins", "marketplace", "skills", "ai", "developer-tools"],
  "author": {
    "name": "kulovema2012",
    "url": "https://github.com/kulovema2012"
  },
  "skills": [
    {
      "name": "task-service",
      "path": "task-service/skills/task-service/SKILL.md",
      "description": "How to use the task-service MCP tools to manage tasks, track project progress, log decisions, and maintain session continuity across Claude Code sessions."
    },
    {
      "name": "engineering-mentor",
      "path": "engineering-mentor/skills/engineering-mentor/SKILL.md",
      "description": "A proactive engineering mentor that activates during ANY technical decision — coding, system design, tool selection, architecture planning, adding dependencies, choosing patterns, or reviewing approaches."
    }
  ]
}
```

- [ ] **Step 2: Replace `task-service/plugin.json`**

```json
{
  "name": "task-service",
  "description": "Skills for using the task-service MCP tools — task management, session continuity, and decision logging across Claude Code sessions.",
  "version": "1.0.0",
  "license": "MIT",
  "repository": "https://github.com/kulovema2012/claude-code-plugins",
  "keywords": ["claude-code", "task-management", "mcp", "session-continuity", "decision-logging"],
  "author": {
    "name": "kulovema2012",
    "url": "https://github.com/kulovema2012"
  },
  "skills": [
    {
      "name": "task-service",
      "path": "skills/task-service/SKILL.md",
      "description": "How to use the task-service MCP tools to manage tasks, track project progress, log decisions, and maintain session continuity across Claude Code sessions."
    }
  ]
}
```

- [ ] **Step 3: Replace `engineering-mentor/plugin.json`**

```json
{
  "name": "engineering-mentor",
  "description": "A proactive engineering mentor that activates during any technical decision — coding, system design, tool selection, architecture planning, and more. Interrupts when spotting bad habits or anti-patterns and gives clear best-practice recommendations.",
  "version": "1.0.0",
  "license": "MIT",
  "repository": "https://github.com/kulovema2012/claude-code-plugins",
  "keywords": ["claude-code", "engineering", "mentor", "best-practices", "anti-patterns", "code-review"],
  "author": {
    "name": "kulovema2012",
    "url": "https://github.com/kulovema2012"
  },
  "skills": [
    {
      "name": "engineering-mentor",
      "path": "skills/engineering-mentor/SKILL.md",
      "description": "A proactive engineering mentor that activates during ANY technical decision — coding, system design, tool selection, architecture planning, adding dependencies, choosing patterns, or reviewing approaches."
    }
  ]
}
```

- [ ] **Step 4: Verify all three files are valid JSON**

```bash
cat plugin.json | python3 -c "import sys,json; json.load(sys.stdin); print('OK')"
cat task-service/plugin.json | python3 -c "import sys,json; json.load(sys.stdin); print('OK')"
cat engineering-mentor/plugin.json | python3 -c "import sys,json; json.load(sys.stdin); print('OK')"
```

Expected: three `OK` lines.

- [ ] **Step 5: Commit**

```bash
git add plugin.json task-service/plugin.json engineering-mentor/plugin.json
git commit -m "🔧 chore: add license, repository, and keywords to plugin.json files"
```

---

### Task 3: Add MIT LICENSE

**Files:**
- Create: `LICENSE`

- [ ] **Step 1: Create `LICENSE`**

Write the following content to `LICENSE` (replace nothing — write exactly this):

```
MIT License

Copyright (c) 2026 kulovema2012

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Verify**

```bash
head -3 LICENSE
```

Expected:
```
MIT License

Copyright (c) 2026 kulovema2012
```

- [ ] **Step 3: Commit**

```bash
git add LICENSE
git commit -m "📝 docs: add MIT license"
```

---

### Task 4: Add CHANGELOG.md

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Create `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `LICENSE` — MIT license
- `CHANGELOG.md` — version history
- `CONTRIBUTING.md` — guide for adding new plugins
- Root `plugin.json` — unified entry point for single-ZIP Claude Desktop install
- `license`, `repository`, and `keywords` fields to all `plugin.json` files

### Changed
- `.gitignore` — expanded to cover secrets, logs, build artifacts, and Claude Code session state
- `.claude/settings.json` — enable task-service and engineering-mentor plugins locally
- `README.md` — updated plugin structure example and ZIP install instructions
- `CLAUDE.md` — trimmed to under 200 lines

### Removed
- Duplicate `.claude-plugin/plugin.json` files from each plugin directory

## [1.0.0] - 2026-03-29

### Added
- `task-service` plugin — MCP-connected task management, session continuity, and decision logging
- `engineering-mentor` plugin — proactive best-practice guidance and anti-pattern detection
- `.claude-plugin/marketplace.json` — central plugin registry
- `README.md` — installation instructions and plugin documentation
- `CLAUDE.md` — principal software engineer persona and execution protocols
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "📝 docs: add changelog"
```

---

### Task 5: Add CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Create `CONTRIBUTING.md`**

```markdown
# Contributing

Thanks for your interest in contributing! This repo is a personal Claude Code plugin marketplace. Contributions that add new plugins or improve existing skills are welcome.

## Repo Structure

```
claude-code-plugins/
├── plugin.json                    # Unified root manifest (all skills, for single-ZIP install)
├── .claude-plugin/
│   └── marketplace.json           # Plugin registry (lists all plugins)
├── task-service/                  # One directory per plugin
│   ├── plugin.json                # Plugin manifest
│   └── skills/
│       └── task-service/
│           └── SKILL.md           # Skill content
└── engineering-mentor/
    ├── plugin.json
    └── skills/
        └── engineering-mentor/
            └── SKILL.md
```

## Adding a New Plugin

### 1. Create the plugin directory

Use lowercase, hyphen-separated names:

```
your-plugin-name/
├── plugin.json
└── skills/
    └── your-plugin-name/
        └── SKILL.md
```

### 2. Write `plugin.json`

```json
{
  "name": "your-plugin-name",
  "description": "One sentence describing what this plugin does.",
  "version": "1.0.0",
  "license": "MIT",
  "repository": "https://github.com/kulovema2012/claude-code-plugins",
  "keywords": ["claude-code", "relevant", "keywords"],
  "author": {
    "name": "your-github-username",
    "url": "https://github.com/your-github-username"
  },
  "skills": [
    {
      "name": "your-plugin-name",
      "path": "skills/your-plugin-name/SKILL.md",
      "description": "Detailed trigger description — when should this skill activate?"
    }
  ]
}
```

### 3. Write `SKILL.md`

Required frontmatter:

```markdown
---
name: your-plugin-name
description: >
  Precise description of when to invoke this skill. Include trigger phrases,
  contexts, and conditions. This is what the harness uses to decide activation.
---

# Your Plugin Name

[Skill content here]
```

Good `description` fields are specific about **when** the skill activates, not just what it does. Compare:

- Bad: "A skill for refactoring code"
- Good: "Invoke when the user asks to refactor, clean up, or restructure existing code — not when writing new code from scratch"

### 4. Register in `.claude-plugin/marketplace.json`

Add an entry to the `plugins` array:

```json
{
  "name": "your-plugin-name",
  "source": "./your-plugin-name",
  "description": "Same one-sentence description as plugin.json"
}
```

### 5. Register in root `plugin.json`

Add a skill entry to the `skills` array:

```json
{
  "name": "your-plugin-name",
  "path": "your-plugin-name/skills/your-plugin-name/SKILL.md",
  "description": "Same trigger description as SKILL.md frontmatter"
}
```

### 6. Update `CHANGELOG.md`

Add your plugin under `[Unreleased] > Added`.

## Submitting a PR

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-plugin-name`
3. Commit atomically — one commit per logical change
4. Open a PR against `master` with a clear description of what the plugin does and when it activates

## Naming Conventions

| Thing | Convention | Example |
|-------|------------|---------|
| Plugin directory | lowercase, hyphens | `code-reviewer` |
| Plugin name in JSON | same as directory | `"name": "code-reviewer"` |
| Skill name | same as plugin name | `"name": "code-reviewer"` |
| SKILL.md location | `skills/<name>/SKILL.md` | `skills/code-reviewer/SKILL.md` |
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "📝 docs: add contributing guide"
```

---

### Task 6: Update .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Replace `.gitignore` with expanded version**

```
# OS
.DS_Store
Thumbs.db

# Environment secrets
.env
.env.*
!.env.example

# Logs
*.log

# Dependencies
node_modules/

# Build output
dist/
build/

# Claude Code session state (keep settings.json tracked)
.claude/agents/
.claude/tasks/
.claude/plans/
.claude/*.local.*

# Generated ZIPs
*.zip
```

- [ ] **Step 2: Verify no tracked files are now ignored**

```bash
git ls-files -i --exclude-standard
```

Expected: no output (no currently-tracked files are being newly ignored).

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "🔧 chore: expand .gitignore for secrets, logs, and session state"
```

---

### Task 7: Update .claude/settings.json

**Files:**
- Modify: `.claude/settings.json`

- [ ] **Step 1: Replace `.claude/settings.json`**

```json
{
  "enabledPlugins": {
    "plugin-dev@claude-plugins-official": true,
    "task-service@claude-code-plugins": true,
    "engineering-mentor@claude-code-plugins": true
  }
}
```

- [ ] **Step 2: Verify valid JSON**

```bash
cat .claude/settings.json | python3 -c "import sys,json; json.load(sys.stdin); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "🔧 chore: enable task-service and engineering-mentor plugins locally"
```

---

### Task 8: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the full `README.md`**

```markdown
# Claude Code Plugins

Personal Claude Code plugin marketplace with skills and tools for AI-assisted development workflows.

## Install this marketplace

```bash
/plugin marketplace add kulovema2012/claude-code-plugins
```

## Available Plugins

### task-service

Skills for using the [task-service](https://github.com/kulovema2012/task-service) MCP tools — task management, session continuity, and decision logging across Claude Code sessions.

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

## Installation Options

### Option 1: Claude Code (via plugin command)

```bash
/plugin install task-service@claude-code-plugins
/plugin install engineering-mentor@claude-code-plugins
```

### Option 2: Claude Code (via ZIP download)

1. [Download the ZIP](https://github.com/kulovema2012/claude-code-plugins/archive/refs/heads/master.zip)
2. Extract and copy the plugin folder into your project's `.claude/plugins/` directory:

```
your-project/
└── .claude/
    └── plugins/
        └── task-service/           ← copy from extracted ZIP
            ├── plugin.json
            └── skills/
                └── task-service/
                    └── SKILL.md
```

### Option 3: Claude Desktop App (single ZIP — all plugins)

> Requires Pro, Max, Team, or Enterprise plan.

1. Clone or download this repo
2. From the repo root, create the ZIP:

```bash
zip -r claude-code-plugins.zip . --exclude ".git/*" --exclude "*.zip"
```

3. In Claude Desktop: go to **Customize > Browse plugins**
4. Upload `claude-code-plugins.zip` — installs all plugins at once

The root `plugin.json` acts as the unified manifest. Claude Desktop reads it and registers all skills automatically.

---

## Adding more plugins

Each plugin lives in its own directory:

```
claude-code-plugins/
├── plugin.json                    # Add new skill entry here too
├── .claude-plugin/
│   └── marketplace.json           # Register new plugin here
├── task-service/
│   ├── plugin.json
│   └── skills/
│       └── task-service/
│           └── SKILL.md
└── your-new-plugin/               ← add new plugin here
    ├── plugin.json
    └── skills/
        └── skill-name/
            └── SKILL.md
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "📝 docs: update README with correct plugin structure and unified ZIP instructions"
```

---

### Task 9: Trim CLAUDE.md to under 200 lines

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the ASCII art workflow box (lines 34–46) with a compact version**

Find this block in `CLAUDE.md`:

```
```
┌─────────────────────────────────────────────────────────────────┐
│                    ATOMIC PUSH WORKFLOW                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Make ONE logical change (fix bug, add feature, update docs) │
│  2. Run tests:    uv run pytest  OR  bun test                   │
│  3. Run linter:   uvx ruff check OR  bunx eslint                │
│  4. Stage files:  git add <specific-files>                      │
│  5. Commit:       git commit -m "Emoji type(scope): description"│
│  6. Push IMMEDIATELY: git push                                  │
│  7. ONLY THEN move to next task                                 │
└─────────────────────────────────────────────────────────────────┘
```
```

Replace with:

```
**Atomic Push Workflow:**
1. ONE logical change → 2. `uv run pytest` / `bun test` → 3. `uvx ruff check` / `bunx eslint` → 4. `git add <files>` → 5. `git commit -m "Emoji type(scope): msg"` → 6. `git push` → 7. Next task
```

- [ ] **Step 2: Verify line count is under 200**

```bash
wc -l CLAUDE.md
```

Expected: a number less than 200.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "📝 docs: trim CLAUDE.md to under 200 lines"
```

# Production-Ready Public Marketplace — Design Spec

**Date:** 2026-04-07  
**Status:** Approved  
**Scope:** Existing two plugins only (task-service, engineering-mentor). No new plugins.  
**Goal:** Make the repo production-ready for public publishing under MIT license.

---

## 1. Structural Cleanup

### Remove duplicate plugin.json files

Each plugin currently has two identical `plugin.json` files:
- `task-service/plugin.json`
- `task-service/.claude-plugin/plugin.json` ← remove

- `engineering-mentor/plugin.json`
- `engineering-mentor/.claude-plugin/plugin.json` ← remove

The `.claude-plugin/` folder is deleted from both plugin directories. The root `.claude-plugin/marketplace.json` is **not touched** — it is the registry, not a plugin manifest.

### Enrich all plugin.json files

Add three fields to the root `plugin.json` and both plugin `plugin.json` files:

```json
{
  "license": "MIT",
  "repository": "https://github.com/kulovema2012/claude-code-plugins",
  "keywords": [...]
}
```

**Root `plugin.json` keywords:** `["claude-code", "plugins", "marketplace", "skills", "ai", "developer-tools"]`  
**task-service keywords:** `["claude-code", "task-management", "mcp", "session-continuity", "decision-logging"]`  
**engineering-mentor keywords:** `["claude-code", "engineering", "mentor", "best-practices", "anti-patterns", "code-review"]`

---

## 2. New Files

### LICENSE

Standard MIT license. Copyright holder: kulovema2012. Year: 2026.

### CHANGELOG.md

Follows [Keep a Changelog](https://keepachangelog.com) format with semantic versioning.

Structure:
- `[Unreleased]` — changes in this improvement batch
- `[1.0.0] - 2026-03-29` — initial release (task-service + engineering-mentor plugins)

### CONTRIBUTING.md

Covers:
1. Repo structure overview
2. How to add a new plugin — required files and folder layout
3. Plugin naming conventions (lowercase, hyphen-separated)
4. How to register in `marketplace.json` and root `plugin.json`
5. Skill writing guidelines — required frontmatter fields, trigger description quality
6. How to submit a PR (fork → branch → PR against master)

---

## 3. Updates to Existing Files

### .gitignore

Add:
```
# Environment
.env*

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

### .claude/settings.json

Enable both plugins locally for development:
```json
{
  "enabledPlugins": {
    "plugin-dev@claude-plugins-official": true,
    "task-service@claude-code-plugins": true,
    "engineering-mentor@claude-code-plugins": true
  }
}
```

### README.md

Two targeted fixes:
1. **"Adding more plugins" section** — Remove `.claude-plugin/` subfolder from the example structure. New plugins only need a root-level `plugin.json` and `skills/` directory.
2. **ZIP install instructions** — Reference the unified root `plugin.json` for single-ZIP installation. Update the ZIP creation command to exclude `.git/` and `*.zip`.

### CLAUDE.md

Trim from 206 to under 200 lines by:
- Condensing the tool selection matrix (remove redundant column headers)
- Tightening phrasing in the MCP orchestration section
- No content removed — only wording compressed

---

## Out of Scope

- New plugins
- GitHub Actions / CI validation
- Pre-commit hooks
- Skill content changes (SKILL.md files are not modified)
- MCP configuration or server setup

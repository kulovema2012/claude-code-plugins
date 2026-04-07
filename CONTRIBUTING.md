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
├── .claude-plugin/
│   └── plugin.json    ← required for Claude Code CLI
├── plugin.json        ← required for Claude Desktop ZIP
└── skills/
    └── your-plugin-name/
        └── SKILL.md
```

Both `plugin.json` files must have identical content.

### 2. Write both `plugin.json` files

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

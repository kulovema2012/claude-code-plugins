# Contributing

Thanks for your interest in contributing! This repo is a personal Claude Code plugin marketplace. Contributions that add new plugins or improve existing skills are welcome.

## Repo Structure

Per the [official plugin spec](https://code.claude.com/docs/en/plugins-reference), the repo has a single root manifest that references skill directories across all plugins:

```
claude-code-plugins/
├── .claude-plugin/
│   ├── plugin.json                # Plugin manifest (references all skill paths)
│   └── marketplace.json           # Marketplace registry
├── task-service/
│   └── skills/
│       └── task-service/
│           └── SKILL.md
└── engineering-mentor/
    └── skills/
        └── engineering-mentor/
            └── SKILL.md
```

## Adding a New Plugin

### 1. Create the skill directory

Use lowercase, hyphen-separated names:

```
your-plugin-name/
└── skills/
    └── your-plugin-name/
        └── SKILL.md
```

### 2. Add skill path to `.claude-plugin/plugin.json`

Add your skill directory to the `skills` array:

```json
{
  "skills": [
    "./task-service/skills/",
    "./engineering-mentor/skills/",
    "./your-plugin-name/skills/"
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
  "description": "Same one-sentence description as SKILL.md"
}
```

### 5. Update `CHANGELOG.md`

Add your plugin under `[Unreleased] > Added`.

### 6. Test locally

Load the plugin to verify it works:

```bash
claude --plugin-dir .
```

Test the skill runs correctly and the manifest is valid.

## Submitting a PR

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-plugin-name`
3. Commit atomically — one commit per logical change
4. Open a PR against `master` with a clear description of what the plugin does and when it activates

## Naming Conventions

| Thing | Convention | Example |
|-------|------------|---------|
| Plugin directory | lowercase, hyphens | `code-reviewer` |
| Skill name | same as directory | `"name": "code-reviewer"` |
| SKILL.md location | `<dir>/skills/<name>/SKILL.md` | `code-reviewer/skills/code-reviewer/SKILL.md` |

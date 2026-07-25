---
name: sync-ai-resources
description: >
  Syncs the currently available agents and skills into project documentation files —
  CLAUDE.md and AGENTS.md. Use this skill whenever the user wants to update, refresh,
  or sync the agent/skill reference tables in CLAUDE.md; create or update an AGENTS.md
  file at the project root; or keep project AI resource docs current with what is
  actually available in the session. Trigger on phrases like "update resources",
  "sync agents", "update CLAUDE.md agents", "refresh skills list", "update AGENTS.md",
  "sync AI resources", "keep agents in sync", or "instruction prompt to update resources".
---

# sync-ai-resources

Keeps `CLAUDE.md` and `AGENTS.md` in sync with the agents and skills that are actually
available in the current Claude Code session.

## Source of truth

The session's `system-reminder` blocks contain two canonical lists:

- **`Available agent types`** — every `subagent_type` value and its description
- **`Available skills`** — every skill name and its trigger description

Read these blocks directly from the current context. Do **not** invent entries that are
not present. Do not carry over stale entries from the existing files.

## Step 1 — Update CLAUDE.md

Target sections (edit only these; leave everything else untouched):

### Agents — Quick Reference table

Group agents into these domain rows (add a row only if at least one agent belongs there):

| Category | Key Agents |
| Explore & Plan | ... |
| Frontend | ... |
| Backend | ... |
| Database | ... |
| Quality | ... |
| Infrastructure | ... |
| Monitoring | ... |
| Teams | ... |
| General | ... |

### Skills — Quick Reference table

Group skills by plugin prefix (`superpowers`, `agent-teams`, `vercel`, `stripe`,
`backend-development`, `cloudflare`, etc.). List the most commonly used skills per group.

### Key plugin groups line

Update the counts in this line to match reality:
```
**Key plugin groups:** superpowers (N), agent-teams (N), vercel (N), ...
```

Keep `CLAUDE.md` under 200 lines total. If the file does not exist, do not create it —
only edit existing content.

## Step 2 — Create or overwrite AGENTS.md at project root

Write a full catalog, one row per agent, grouped by domain, using this table format:

```markdown
# Agents Catalog

> Auto-generated from available session agents. Run `/sync-ai-resources` to refresh.

## Explore & Plan
| Agent | When to Use |
|-------|-------------|
| `Explore` | ... |

## Frontend
...
```

Include every agent from the `Available agent types` system-reminder block.

## Step 3 — Sync .claude/rules/ files (if they exist)

If `.claude/rules/agents-catalog.md` exists, overwrite it with the same content as
`AGENTS.md` (minus the top-level heading).

If `.claude/rules/skills-catalog.md` exists, update its tables to reflect the current
skill list from the session, preserving all existing section structure.

## Constraints

- Source strictly from the current session's system-reminder — no invented entries.
- Preserve all other CLAUDE.md sections (Rules, Git workflow, Key Commands, etc.).
- CLAUDE.md must stay under 200 lines.
- Commit with: `📝 docs: sync agents and skills catalog to latest available resources`
  using the project's configured git author before pushing.

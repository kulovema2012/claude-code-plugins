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

## Adding more plugins

Each plugin lives in its own directory:

```
claude-code-plugins/
├── .claude-plugin/
│   └── marketplace.json      ← register new plugins here
├── task-service/
│   ├── .claude-plugin/
│   │   └── plugin.json
│   └── skills/
│       └── task-service/
│           └── SKILL.md
└── your-new-plugin/          ← add new plugin here
    ├── .claude-plugin/
    │   └── plugin.json
    └── skills/
        └── skill-name/
            └── SKILL.md
```

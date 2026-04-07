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
            ├── .claude-plugin/
            │   └── plugin.json
            └── skills/
                └── task-service/
                    └── SKILL.md
```

### Option 3: Claude Desktop App (Cowork tab)

> Requires Pro, Max, Team, or Enterprise plan.

1. [Download the ZIP](https://github.com/kulovema2012/claude-code-plugins/archive/refs/heads/master.zip)
2. Extract and re-zip the individual plugin folder you want (e.g. `task-service/`)
3. In Claude desktop app: go to **Customize > Browse plugins**
4. Upload the ZIP via the custom plugin upload option

---

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

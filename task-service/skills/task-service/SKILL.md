---
name: task-service
description: How to use the task-service MCP tools to manage tasks, track project progress, log decisions, and maintain session continuity across Claude Code sessions. Invoke this skill at the START of every coding session, whenever creating or updating tasks during development, when logging architectural decisions, and at the END of every session. Also use when the user mentions tasks, projects, tracking work items, picking up where they left off, or wanting to remember decisions made during a session.
---

# Task Service

A persistent task management service connected via MCP. It tracks tasks and projects, logs architectural decisions, and gives you a memory across sessions so you always know where you left off.

## Session Lifecycle

Follow this pattern every session:

### 1. Start — resume context
```
session_start({ projectId: "<id>" })
```
Returns the last session summary and the `nextStep` cursor — what was left to do. If you don't have the project ID yet, call `project_list` first to find or create it.

### 2. Work — track as you go
Create tasks for significant pieces of work, update their status as they progress, and log decisions when you make them. Don't wait until the end — tracking in real time keeps the dashboard accurate and gives future sessions richer context.

### 3. End — save a handoff
```
session_end({
  projectId: "<id>",
  summary: "What was accomplished this session",
  nextStep: "Concrete next action for the next session",
  commitHash: "<git SHA if applicable>"
})
```
The `nextStep` field is what `session_start` will surface next time — make it specific enough to act on immediately.

---

## Task Management

### Creating tasks

```
task_create({
  projectId: "<id>",
  title: "Short, actionable title",
  description: "What needs to be done and why",
  status: "pending",       // pending | in_progress | completed | blocked
  priority: "high",        // high | medium | low
  type: "feature",         // feature | bug | chore | test | docs | handoff | decision | debt
  tags: ["optional"]
})
```

Create a task for anything non-trivial: features being built, bugs found along the way, follow-ups that can't be done right now, or handoffs to future sessions. The `type` field is especially useful — `handoff` and `decision` tasks serve as structured notes, not just work items.

### Updating status

Move tasks through the lifecycle as you work — this syncs with the Kanban dashboard in real time:

```
task_update({ id: "<id>", status: "in_progress" })
// ... do the work ...
task_update({ id: "<id>", status: "completed" })
```

You can update any field: `title`, `description`, `priority`, `type`, `tags`.

### Finding tasks

```
task_list({ projectId: "<id>" })       // All tasks for a project
task_search({ query: "auth bug" })     // Full-text search
task_find_similar({ id: "<id>" })      // Semantically similar tasks
```

---

## Decision Logging

When you choose between approaches, accept technical debt intentionally, or make an API/architecture call, log it:

```
decision_log({
  projectId: "<id>",
  title: "One-line summary of the decision",
  why: "The reasoning — constraints, tradeoffs, and context future-you will need"
})
```

Good decisions to log:
- Choosing one library/pattern over another
- Accepting a known limitation or shortcut
- Settling on an API contract or data model
- Anything that would confuse someone reading the code without context

The `why` field is semantically indexed — future sessions can search for decisions and find the reasoning behind them.

---

## Project Management

```
project_list()                              // Find existing projects
project_create({ name, description })       // Start a new project
project_get_tasks({ id: "<project-id>" })  // All tasks for a project
```

---

## Full Session Example

```
// --- Session start ---
const ctx = await session_start({ projectId: "proj-abc" });
// → "Last session: wired up ChromaDB storage. Next step: add search endpoint"

// Create a task for this session's work
const task = await task_create({
  projectId: "proj-abc",
  title: "Add /api/tasks/search endpoint",
  status: "in_progress",
  priority: "high",
  type: "feature"
});

// ... implement the feature ...

// Log a decision made along the way
await decision_log({
  projectId: "proj-abc",
  title: "POST /search instead of GET with query params",
  why: "Search query can include filters and embeddings that exceed URL length limits. POST body is more flexible and easier to version."
});

// Mark the task done
await task_update({ id: task.id, status: "completed" });

// --- Session end ---
await session_end({
  projectId: "proj-abc",
  summary: "Added POST /api/tasks/search with full-text and semantic search support",
  nextStep: "Add search to the dashboard SearchBar component",
  commitHash: "a3f92c1"
});
```

---

## Quick Reference

| Tool | When to use |
|------|-------------|
| `session_start` | First thing every session |
| `session_end` | Last thing every session |
| `task_create` | Starting non-trivial work |
| `task_update` | Status changes, field edits |
| `task_list` | See what's open on a project |
| `task_search` | Find tasks by keyword |
| `decision_log` | Made a non-obvious technical choice |
| `project_list` | Find or verify project ID |
| `project_create` | Starting work on a new codebase |

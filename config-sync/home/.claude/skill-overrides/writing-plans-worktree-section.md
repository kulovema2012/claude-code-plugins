## Worktree Resolution

Before writing any plan content, determine the worktree. This must be in the plan header so every engineer knows exactly where to work.

### Step 1 — Discover this project's worktree convention

Every project organises worktrees differently. Do not assume a path — discover it first.

```bash
git worktree list
```

Read the output. Existing worktrees (besides the main one) reveal the convention:

| What you see | Convention |
|---|---|
| `/path/to/repo/.claude/worktrees/auth [feat/auth]` | `.claude/worktrees/<slug>` + `feat/<slug>` |
| `/path/to/repo/.worktrees/auth [feat/auth]` | `.worktrees/<slug>` + `feat/<slug>` |
| `/path/to/repo/../repo-auth [feat/auth]` | sibling directories |
| Only main/HEAD listed | No worktrees yet — check project config |

If no worktrees exist yet, also check:

```bash
ls .claude/worktrees/ 2>/dev/null || ls .worktrees/ 2>/dev/null || echo "none found"
grep -i "worktree" CLAUDE.md 2>/dev/null | head -5
```

If no convention is found anywhere, default to `.claude/worktrees/<slug>` with branch `feat/<slug>`.

### Step 2 — Derive the feature slug

From the plan's feature name, produce a short kebab-case slug matching existing worktree naming in this project (shorter is better):

- "Onboarding Wizard UX Refinement" → `onboarding`
- "Business Profile Create/Edit" → `business`
- "Grant Matching AI Results" → `grant-matching`
- "User Authentication Flow" → `auth`

### Step 3 — Check if the worktree already exists

Search `git worktree list` for an entry whose path ends in the slug.

**If found:** record the path and branch exactly as shown. Done — skip Step 4.

**If not found:** proceed to Step 4.

### Step 4 — Create the worktree

Use the convention from Step 1. Invoke `superpowers:using-git-worktrees` or run directly:

```bash
git worktree add <worktree-path> -b <branch-name>
git worktree list
# Expected: new line showing <worktree-path>  [<branch-name>]
```

### Result

Record in the plan header:

```
**Worktree:** `<worktree-path>` (`<branch-name>`)
```
# Design: Global Config Sync (Claude Code + Codex + `.agents`)

- **Date:** 2026-07-25
- **Status:** Approved (pending spec review)
- **Owner:** Newk
- **Scope:** Single sub-project — adds a portable, cross-platform config-sync layer to this repo.

## 1. Goal & Success Criteria

Clone this repo on a brand-new Windows **or** macOS/Linux device, run one command, and have
Claude Code, Codex, and the shared `.agents` skills behave the same way they do on the current
machine — minus machine-bound credentials, which are re-authenticated once.

**Success criteria:**

1. A new-device clone + `bun run config-sync/install.mjs` restores the portable global config.
2. No plaintext secret (API key, bearer token, OAuth credential) ever enters git history.
3. Machine-bound state (~2.5 GB: caches, transcripts, worktrees, sqlite logs, plugin downloads)
   is never committed.
4. The same installer runs unchanged on Windows, macOS, and Linux.
5. Edits made to live config can be re-captured into the repo via a reverse `sync.mjs`.
6. Installer logic is unit-tested (AAA) and passes a secret-scan guard.

## 2. Non-Goals

- Syncing conversation transcripts / session history / telemetry (machine-bound, not portable).
- Syncing the plugin **download cache** (503 MB in `~/.claude/plugins/cache+data`, 532 MB in
  `~/.codex/plugins`) — fully regenerable from the small registry files.
- Syncing OAuth credentials (`auth.json`, `.credentials.json`, `installation_id`, `cap_sid`,
  `secrets/`, `.sandbox-secrets/`) — re-authenticated per device.
- Migrating the existing plugin-*development* workflow in this repo (unchanged).

## 3. Current State (source inventory)

Portable, non-secret config (the sync set, ~15 MB total):

| Source | Items |
|---|---|
| `~/.claude/` | `statusline.js`, `hooks/`, `skills/` (1.9 MB), `commands/`, `workflows/`, `scripts/`, `skill-overrides/`, `.remember/`, plugin registry (`plugins/installed_plugins.json`, `plugins/known_marketplaces.json`, `plugins/blocklist.json`) |
| `~/.codex/` | `AGENTS.md`, `hooks.json`, `keybindings.json`, `memories/` (459 KB), `skills/` (7 MB), `rules/`, `version.json` |
| `~/.agents/` | `skills/`, `skills-disabled/`, `.skill-lock.json`, `plugins/` |

Secret-bearing files (handled via templating, **not** committed as-is):

- `~/.claude/settings.json` — line 41 holds an API key (`sk-…`).
- `~/.codex/config.toml` — holds an API key (`sk-…`, L126), a `Bearer` token (L148), and ~25
  hard-coded `C:\Users\new_k\…` paths (L69…L291).

Excluded machine-state (~2.5 GB): Claude `plugins/{cache,data,marketplaces}`, `projects/`,
`context-mode/`, `security/`, `file-history/`, `shell-snapshots/`, `backups/`, `cache/`,
`debug/`, `paste-cache/`, `session-env/`, `telemetry/`, all `*.sqlite*`, `history.jsonl`,
`settings.json.bak`, `.credentials.json`, `stats-cache.json`, `daemon*`; Codex `worktrees/`
(920 MB), `sessions/`, `.tmp/`, plugin cache, `logs_*.sqlite*`, `auth.json`, `secrets/`,
`.sandbox-secrets/`, `installation_id`, `state_*.sqlite*`, `memories_*.sqlite`,
`goals_*.sqlite`, `models_cache.json`, `history.jsonl`, `session_index.jsonl`,
`generated_images/`, `attachments/`.

## 4. Architecture

A dedicated `config-sync/` subtree coexists with the existing plugin-dev content. The repo
`.gitignore` rules are anchored to repo-root `.claude/`, so `config-sync/home/.claude/…` is
**not** ignored and tracks normally.

```
config-sync/
├── README.md              # clone-and-restore quickstart
├── manifest.json          # source→dest map (single source of truth)
├── install.mjs            # cross-platform installer (bun/node, zero deps)
├── sync.mjs               # reverse capture: live config → repo
├── package.json           # { "type":"module" } + bun test script
├── .gitignore             # blocks .env.local + stray real-secret paths
├── .env.example           # documents secret placeholders
├── templates/             # templatized secret-bearing files
│   ├── claude/settings.json.tmpl
│   └── codex/config.toml.tmpl
├── home/                  # portable, non-secret config mirroring ~/
│   ├── .claude/{statusline.js, hooks, skills, commands, workflows,
│   │            scripts, skill-overrides, .remember, plugins/*.json}
│   ├── .codex/{AGENTS.md, hooks.json, keybindings.json, memories,
│   │          skills, rules, version.json}
│   └── .agents/{skills, skills-disabled, .skill-lock.json, plugins}
└── tests/
    ├── template.test.mjs
    ├── manifest.test.mjs
    └── paths.test.mjs
```

### 4.1 Components

- **`manifest.json`** — declarative list the installer iterates. Single source of truth so
  `install.mjs` and `sync.mjs` share one definition.
- **`install.mjs`** — reads `manifest.json`, resolves `~` via `os.homedir()`, renders
  templates, and places files (copy by default; `--symlink` on supporting platforms).
- **`sync.mjs`** — reverse direction: copies live portable config back into `home/` and
  regenerates templates from live files, with a secret-scan guard.
- **`templates/`** — secret-bearing files with `{{PLACEHOLDER}}` tokens; real files stay
  gitignored and are *generated* on the target.

### 4.2 `manifest.json` schema

```jsonc
{
  "version": 1,
  "targets": [
    { "src": "home/.claude/statusline.js",  "dest": "~/.claude/statusline.js", "type": "file" },
    { "src": "home/.claude/hooks",          "dest": "~/.claude/hooks",         "type": "dir" },
    // …all portable entries…
    { "src": "templates/claude/settings.json.tmpl", "dest": "~/.claude/settings.json", "type": "template", "mode": "0600" },
    { "src": "templates/codex/config.toml.tmpl",    "dest": "~/.codex/config.toml",    "type": "template", "mode": "0600" }
  ]
}
```

`type`: `file` (copy single file) · `dir` (recursive copy) · `template` (render then write).

## 5. Secrets = Templating

- **Placeholder scheme:** `{{NAME}}`. Two categories:
  - Reserved: `{{HOME}}` → `os.homedir()` on the target device (see §6).
  - User-defined, sourced from a gitignored `.env.local` (KEY=VALUE), e.g.
    `CLAUDE_API_KEY`, `CODEX_API_KEY`, `CODEX_BEARER`.
- **`templates/claude/settings.json.tmpl`:** the `sk-…` value → `{{CLAUDE_API_KEY}}`.
- **`templates/codex/config.toml.tmpl`:** API key → `{{CODEX_API_KEY}}`,
  `Bearer …` → `{{CODEX_BEARER}}`, every `C:\Users\new_k\…` → `{{HOME}}/…`.
- The real `settings.json` / `config.toml` are gitignored; the installer renders them from
  `config-sync/.env.local` (copied from `config-sync/.env.example` on first setup). The
  installer resolves `.env.local` relative to the script directory, not the cwd.
- A required-placeholder check fails loud if a placeholder is unset (override:
  `--allow-missing` writes the literal token for manual fill-in).
- `.env.example` is committed and lists every placeholder with a `# where to get it` comment;
  `.env.local` is never committed.

## 6. Cross-Platform Path Handling

`{{HOME}}` expands to `os.homedir()` rendered in **forward-slash** form universally
(e.g. `C:/Users/new_k` on Windows, `/Users/newk` on macOS). Forward slashes are accepted by
Codex/Claude config consumers on Windows and avoid TOML backslash-escape ambiguity.

> **Verification item V1:** confirm every `{{HOME}}`-substituted path in `config.toml` is
> accepted by Codex on Windows with forward slashes. If any consumer rejects `/`, fall back to
> `path.sep`-joined segments for that entry and document the exception.

## 7. Restore Flow (hybrid, cross-platform)

`bun run config-sync/install.mjs [--dry-run] [--force] [--symlink] [--allow-missing]`

1. Resolve `os.homedir()`.
2. Load `.env.local` into the placeholder map (always include `HOME`).
3. For each manifest target, in order:
   - `file`/`dir`: copy. "Merge" = copy source entries *into* the destination, overwriting a
     destination file only when `--force` is set; never delete files that exist only in the
     destination.
   - `template`: render placeholders → write to `dest` (chmod `0600` if specified).
4. `--symlink` mode: on macOS/Linux, symlink repo entry → `~/dest` (live sync); on Windows,
   fall back to copy with a one-line note (symlinks need Developer Mode/admin and aren't
   reliably followed by all tools).
5. `--dry-run` prints every planned action without writing.
6. Print a summary + the manual re-auth checklist (see §9).

Zero runtime dependencies: `node:fs`, `node:path`, `node:os` only.

## 8. Reverse Sync Flow

`bun run config-sync/sync.mjs [--dry-run] [--refresh-secrets]`

1. For each manifest `file`/`dir`, copy live `~/dest` → repo `home/src` (overwrite repo copy).
2. Regenerate templates from live `settings.json` / `config.toml`: detect known secret values
   via the same regex set used by the secret scanner, replace them with their `{{TOKEN}}`, and
   normalize `os.homedir()` substrings → `{{HOME}}`. **Guard:** refuses to write a template that
   still contains a live secret unless `--refresh-secrets` is passed.
3. Run the secret scanner over the entire `config-sync/` tree; abort if any secret pattern is
   found in tracked content.

## 9. Plugins

- Portable registry (`installed_plugins.json`, `known_marketplaces.json`, `blocklist.json`) is
  restored to `~/.claude/plugins/`. Claude re-downloads plugin caches on next start.
- This repo's own plugins (`engineering-mentor`, `project-boilerplate`, `task-service`) can be
  registered as a **local marketplace** so they reinstall from the clone.
- **Verification item V2:** confirm Claude auto-restores enabled plugins from the registry
  alone, or document the explicit `/plugin install` step users must run.

## 10. Manual post-restore checklist (documented in README)

1. Re-authenticate Claude Code (`/login`) and Codex (`codex login`) — refreshes OAuth creds.
2. Fill `.env.local` (copy from `.env.example`) with API key + bearer token.
3. (If V2 fails) run the documented plugin reinstall command.

## 11. Git Safety

- `config-sync/.gitignore` blocks `.env.local` and any stray real-secret filenames.
- A pre-commit hook (and CI check) greps staged files for `sk-`, `Bearer `, `C:\Users\`,
  private-key headers, and `auth.json`-style tokens; the commit is rejected on a hit.
- The repo root `.gitignore` is extended only if needed; `config-sync/` content tracks normally.

## 12. Testing (AAA, `bun test`)

- **`template.test.mjs`:** `{{HOME}}`/`{{CLAUDE_API_KEY}}` substitution; missing-placeholder
  error path; `--allow-missing` literal passthrough.
- **`paths.test.mjs`:** `{{HOME}}` renders to forward-slash form on a mock Win/Mac/Linux home.
- **`manifest.test.mjs`:** copy/merge against an in-memory mock fs (inject `fs` shim);
  `--force` overwrite; `--dry-run` writes nothing; template write applies `0600`.
- Secret-scan guard unit test: known-secret fixture triggers refusal; clean fixture passes.

Tests use only Node built-ins + `node:test`/`bun:test`; no external deps.

## 13. Open Items / Verification

- **V1:** Forward-slash `{{HOME}}` accepted by Codex on Windows.
- **V2:** Plugin auto-restore from registry vs. explicit reinstall step.
- **V3:** Decide whether to include `~/.claude/notify-sounds/` (1.5 MB) — optional, default
  **exclude** unless requested.

## 14. Out of Scope (future)

- Encrypted-secret mode (age/sops) as an alternative to templating.
- Automatic scheduled reverse-sync.
- Windows symlink-as-default mode.

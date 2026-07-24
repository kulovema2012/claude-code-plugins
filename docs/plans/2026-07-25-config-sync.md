# Config Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a portable, cross-platform `config-sync/` layer that backs up Claude Code + Codex + `.agents` global config into this repo and restores it on a new device via one command — without ever committing secrets or machine state.

**Architecture:** A declarative `manifest.json` drives two zero-dependency Node/Bun scripts. `install.mjs` renders `{{TOKEN}}` templates and copies portable config into `~/` (copy-everywhere default, optional `--symlink` on macOS/Linux). `sync.mjs` reverses the flow, regenerating templates from live files with a secret-scanner guard. Pure library modules (`lib/*.js`) are unit-tested with `bun test` using an injectable `fs`.

**Tech Stack:** Node.js built-ins only (`node:fs`, `node:path`, `node:os`), ESM (`.mjs`), Bun for tests (`bun:test`).

**Worktree:** `.claude/worktrees/config-sync` (`feat/config-sync`)

## Global Constraints

(copied verbatim from `docs/specs/2026-07-25-config-sync-design.md` — every task inherits these)

- **Zero runtime dependencies.** ESM `.mjs`; `node:` built-ins only.
- **Tests via `bun test`** (CLAUDE.md mandates Bun).
- **No plaintext secret ever committed.** `.env.local` is gitignored; secret-bearing files live only as `templates/*.tmpl` with `{{TOKEN}}` placeholders.
- **`{{HOME}}` inside file content renders forward-slash** (e.g. `C:/Users/new_k`); **manifest destination paths resolve native** (`path.join`) so filesystem writes are correct per-OS.
- **Commit messages use Gitmoji** (CLAUDE.md): `✨ feat(config-sync): …`, `✅ test(config-sync): …`, etc. Each task = one atomic commit (+ push).
- **Include/exclude per spec §3.** Portable set only; machine-state (~2.5 GB) never committed. `notify-sounds/` excluded (V3 decision).
- **All paths in commands are relative to the worktree root** unless prefixed with `~/` (live home) or marked absolute.

## File Structure

```
config-sync/
├── package.json                 # Task 1  — { "type":"module" } + scripts
├── .gitignore                   # Task 1  — blocks .env.local
├── .env.example                 # Task 9  — documents placeholders
├── README.md                    # Task 11 — clone-and-restore quickstart
├── manifest.json                # Task 9  — source→dest map (data)
├── install.mjs                  # Task 7  — restore CLI
├── sync.mjs                     # Task 8  — capture CLI (thin wrapper over lib/sync.js)
├── lib/
│   ├── secrets.js               # Task 2  — pattern scanner
│   ├── render.js                # Task 3  — {{TOKEN}} substitution
│   ├── env.js                   # Task 4  — .env.local parser
│   ├── manifest.js              # Task 5  — load/validate/resolve
│   ├── fs-util.js               # Task 6  — injectable copy/merge/write
│   └── sync.js                  # Task 8  — reverse capture + template regen + guard
├── templates/
│   ├── claude/settings.json.tmpl# Task 10 — generated from live by sync.mjs
│   └── codex/config.toml.tmpl   # Task 10 — generated from live by sync.mjs
├── home/                        # Task 10 — populated by running sync.mjs
│   ├── .claude/{…}
│   ├── .codex/{…}
│   └── .agents/{…}
└── tests/
    ├── secrets.test.mjs         # Task 2
    ├── render.test.mjs          # Task 3
    ├── env.test.mjs             # Task 4
    ├── manifest.test.mjs        # Task 5
    ├── fs-util.test.mjs         # Task 6
    ├── install.test.mjs         # Task 7
    └── sync.test.mjs            # Task 8
.github/workflows/secret-scan.yml# Task 11 — CI guard
```

---

## Task 1: Scaffold `config-sync/` project

**Files:**
- Create: `config-sync/package.json`
- Create: `config-sync/.gitignore`

**Interfaces:**
- Produces: an ESM package (`"type":"module"`) so `import` works in `.mjs`; `bun test` wired to `tests/`.

- [ ] **Step 1: Create the directory + package.json**

```json
{
  "name": "config-sync",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Cross-platform backup/restore for Claude Code, Codex, and .agents global config.",
  "scripts": {
    "test": "bun test",
    "install:cfg": "node install.mjs",
    "sync:cfg": "node sync.mjs"
  }
}
```

- [ ] **Step 2: Create `config-sync/.gitignore`**

```
# Local secret values — never commit
.env.local
.env.*.local

# Rendered real files (regenerated on install)
*.rendered
```

- [ ] **Step 3: Verify Bun sees the package**

Run: `cd config-sync && bun --version`
Expected: a version string (e.g. `1.x.x`). No error.

- [ ] **Step 4: Commit**

```bash
git add config-sync/package.json config-sync/.gitignore
git commit -m "🔧 chore(config-sync): scaffold package + gitignore"
git push -u origin feat/config-sync
```

---

## Task 2: Secret scanner (`lib/secrets.js`)

**Files:**
- Create: `config-sync/lib/secrets.js`
- Test: `config-sync/tests/secrets.test.mjs`

**Interfaces:**
- Produces: `scanSecrets(text) -> [{line, kind, redacted}]`, `hasSecret(text) -> boolean`, `SECRET_PATTERNS`.

- [ ] **Step 1: Write the failing test**

```js
// config-sync/tests/secrets.test.mjs
import { test, expect } from 'bun:test';
import { scanSecrets, hasSecret } from '../lib/secrets.js';

test('detects an sk- API key', () => {
  // Arrange
  const text = 'const key = "sk-abcd1234567890efgh";';
  // Act
  const found = scanSecrets(text);
  // Assert
  expect(found.length).toBe(1);
  expect(found[0].kind).toBe('api_key_sk');
  expect(found[0].line).toBe(1);
  expect(found[0].redacted.startsWith('sk-')).toBe(true);
});

test('detects a Bearer token', () => {
  const found = scanSecrets('Authorization: Bearer abcdef123456');
  expect(found[0].kind).toBe('bearer');
});

test('detects a JSON token field', () => {
  const found = scanSecrets('{ "api_key": "supersecretvalue123" }');
  expect(found[0].kind).toBe('token_field');
});

test('returns empty for clean text', () => {
  expect(scanSecrets('just normal config = true')).toEqual([]);
  expect(hasSecret('just normal config = true')).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd config-sync && bun test tests/secrets.test.mjs`
Expected: FAIL — `Cannot find module '../lib/secrets.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// config-sync/lib/secrets.js
// Detects likely secrets without capturing full values (output is redacted).
// Used by lib/sync.js (template-regeneration guard) and CI (.github/workflows/secret-scan.yml).

export const SECRET_PATTERNS = [
  { kind: 'api_key_sk',  re: /sk-[A-Za-z0-9_-]{8,}/g },
  { kind: 'bearer',      re: /Bearer\s+[A-Za-z0-9._-]{6,}/g },
  { kind: 'token_field', re: /("(?:token|access_token|refresh_token|id_token|api[_-]?key|secret|client[_-]?secret|password|apikey|oauthToken)"\s*:\s*")[^"]{3,}/gi },
  { kind: 'private_key', re: /BEGIN (?:RSA|EC|OPENSSH|PGP) PRIVATE KEY/g },
  { kind: 'url_cred',    re: /https?:\/\/[^/\s:@]+:[^/\s:@]+@/ },
];

export function scanSecrets(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const { kind, re } of SECRET_PATTERNS) {
      const pattern = new RegExp(re.source, re.flags);
      let m;
      while ((m = pattern.exec(lines[i])) !== null) {
        findings.push({ line: i + 1, kind, redacted: m[0].slice(0, 8) + '…' });
      }
    }
  }
  return findings;
}

export function hasSecret(text) {
  return scanSecrets(text).length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd config-sync && bun test tests/secrets.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add config-sync/lib/secrets.js config-sync/tests/secrets.test.mjs
git commit -m "✨ feat(config-sync): add secret pattern scanner"
git push
```

---

## Task 3: Template renderer (`lib/render.js`)

**Files:**
- Create: `config-sync/lib/render.js`
- Test: `config-sync/tests/render.test.mjs`

**Interfaces:**
- Consumes: a `placeholders` map prepared by the caller (Task 7 prepares `HOME` as forward-slash + values from `lib/env.js`).
- Produces: `renderTemplate(text, placeholders, opts?) -> { rendered, missing }`. `opts.allowMissing` leaves unknown `{{TOKEN}}` literals in place; default reports them in `missing` (caller errors).

- [ ] **Step 1: Write the failing test**

```js
// config-sync/tests/render.test.mjs
import { test, expect } from 'bun:test';
import { renderTemplate } from '../lib/render.js';

test('substitutes known placeholders', () => {
  // Arrange
  const tmpl = '{"key": "{{CLAUDE_API_KEY}}", "home": "{{HOME}}/.codex"}';
  const ph = { CLAUDE_API_KEY: 'sk-real', HOME: 'C:/Users/new_k' };
  // Act
  const { rendered, missing } = renderTemplate(tmpl, ph);
  // Assert
  expect(rendered).toBe('{"key": "sk-real", "home": "C:/Users/new_k/.codex"}');
  expect(missing).toEqual([]);
});

test('reports missing placeholders by default', () => {
  const { rendered, missing } = renderTemplate('{{X}}', {});
  expect(missing).toEqual(['X']);
  expect(rendered).toBe('{{X}}'); // untouched
});

test('allowMissing leaves literal tokens for manual fill-in', () => {
  const { rendered, missing } = renderTemplate('{{X}}', {}, { allowMissing: true });
  expect(rendered).toBe('{{X}}');
  expect(missing).toEqual(['X']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd config-sync && bun test tests/render.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// config-sync/lib/render.js
// Dumb {{TOKEN}} substitution. Caller prepares values (incl. forward-slash HOME).

const TOKEN_RE = /\{\{(\w+)\}\}/g;

export function renderTemplate(text, placeholders, opts = {}) {
  const missing = new Set();
  const rendered = text.replace(TOKEN_RE, (full, name) => {
    if (Object.prototype.hasOwnProperty.call(placeholders, name)) {
      return String(placeholders[name]);
    }
    missing.add(name);
    return full; // leave literal whether or not allowMissing
  });
  return { rendered, missing: [...missing] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd config-sync && bun test tests/render.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add config-sync/lib/render.js config-sync/tests/render.test.mjs
git commit -m "✨ feat(config-sync): add {{TOKEN}} template renderer"
git push
```

---

## Task 4: `.env.local` parser (`lib/env.js`)

**Files:**
- Create: `config-sync/lib/env.js`
- Test: `config-sync/tests/env.test.mjs`

**Interfaces:**
- Produces: `parseEnv(text) -> {KEY:VALUE}`, `loadEnvFile(path, fs?) -> {KEY:VALUE}` (returns `{}` if file missing — a missing `.env.local` is normal on first run).

- [ ] **Step 1: Write the failing test**

```js
// config-sync/tests/env.test.mjs
import { test, expect } from 'bun:test';
import { parseEnv, loadEnvFile } from '../lib/env.js';

test('parses KEY=VALUE, skipping comments and blanks', () => {
  const text = '# comment\nKEY=val\n\nEMPTY=';
  expect(parseEnv(text)).toEqual({ KEY: 'val', EMPTY: '' });
});

test('strips surrounding quotes', () => {
  expect(parseEnv('A="quoted"\nB=\'single\'')).toEqual({ A: 'quoted', B: 'single' });
});

test('loadEnvFile returns {} when file is missing', async () => {
  const fakeFs = {
    async readFile() { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; },
  };
  expect(await loadEnvFile('/nope/.env.local', fakeFs)).toEqual({});
});

test('loadEnvFile reads via injected fs', async () => {
  const fakeFs = { async readFile() { return 'X=1'; } };
  expect(await loadEnvFile('/anywhere', fakeFs)).toEqual({ X: '1' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd config-sync && bun test tests/env.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// config-sync/lib/env.js
export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

export async function loadEnvFile(path, fs) {
  const f = fs || (await import('node:fs/promises'));
  try {
    const text = await f.readFile(path, 'utf8');
    return parseEnv(text);
  } catch (e) {
    if (e && e.code === 'ENOENT') return {};
    throw e;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd config-sync && bun test tests/env.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add config-sync/lib/env.js config-sync/tests/env.test.mjs
git commit -m "✨ feat(config-sync): add .env.local parser"
git push
```

---

## Task 5: Manifest loader (`lib/manifest.js`)

**Files:**
- Create: `config-sync/lib/manifest.js`
- Test: `config-sync/tests/manifest.test.mjs`

**Interfaces:**
- Produces:
  - `resolveDest(dest, home) -> string` — `~`/`~/`/`~\` → native `path.join(home, …)`; otherwise returned as-is.
  - `validateManifest(obj) -> { ok, errors }`
  - `loadManifest(path, fs?) -> { version, targets:[{src,dest,type,mode?}] }` (throws on invalid).

- [ ] **Step 1: Write the failing test**

```js
// config-sync/tests/manifest.test.mjs
import { test, expect } from 'bun:test';
import { resolveDest, validateManifest, loadManifest } from '../lib/manifest.js';

test('resolveDest expands ~ to native home path', () => {
  const home = process.platform === 'win32' ? 'C:\\Users\\new_k' : '/home/u';
  const out = resolveDest('~/.claude/settings.json', home);
  expect(out.startsWith(home)).toBe(true);
  expect(out).not.toContain('~');
});

test('validateManifest accepts a well-formed object', () => {
  const m = { version: 1, targets: [{ src: 'a', dest: '~/a', type: 'file' }] };
  expect(validateManifest(m).ok).toBe(true);
});

test('validateManifest rejects bad type and missing fields', () => {
  const r = validateManifest({ version: 1, targets: [{ src: 'a', dest: '~/a', type: 'bogus' }] });
  expect(r.ok).toBe(false);
  expect(r.errors.some(e => e.includes('type'))).toBe(true);
});

test('loadManifest throws on invalid content', async () => {
  const fakeFs = { async readFile() { return JSON.stringify({ version: 1, targets: [] }); } };
  // targets empty is valid; force invalid:
  const badFs = { async readFile() { return '{"version":"x"}'; } };
  expect(loadManifest('/m', badFs)).rejects.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd config-sync && bun test tests/manifest.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// config-sync/lib/manifest.js
import { resolve as resolvePath } from 'node:path';

export function resolveDest(dest, home) {
  if (dest === '~') return home;
  if (dest.startsWith('~/') || dest.startsWith('~\\')) return resolvePath(home, dest.slice(2));
  return dest;
}

export function validateManifest(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['manifest: not an object'] };
  if (typeof obj.version !== 'number') errors.push('manifest.version must be a number');
  if (!Array.isArray(obj.targets)) return { ok: false, errors: ['manifest.targets must be an array'] };
  obj.targets.forEach((t, i) => {
    if (!t || typeof t !== 'object') return errors.push(`target[${i}]: not an object`);
    if (typeof t.src !== 'string' || !t.src) errors.push(`target[${i}].src required`);
    if (typeof t.dest !== 'string' || !t.dest) errors.push(`target[${i}].dest required`);
    if (!['file', 'dir', 'template'].includes(t.type)) errors.push(`target[${i}].type must be file|dir|template`);
  });
  return { ok: errors.length === 0, errors };
}

export async function loadManifest(path, fs) {
  const f = fs || (await import('node:fs/promises'));
  const obj = JSON.parse(await f.readFile(path, 'utf8'));
  const v = validateManifest(obj);
  if (!v.ok) throw new Error('Invalid manifest:\n' + v.errors.join('\n'));
  return obj;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd config-sync && bun test tests/manifest.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add config-sync/lib/manifest.js config-sync/tests/manifest.test.mjs
git commit -m "✨ feat(config-sync): add manifest loader + validator"
git push
```

---

## Task 6: Injectable copy/merge (`lib/fs-util.js`)

**Files:**
- Create: `config-sync/lib/fs-util.js`
- Test: `config-sync/tests/fs-util.test.mjs`

**Interfaces:**
- Produces:
  - `copyTree(srcAbs, destAbs, opts) -> actions[]` — recursive copy; **merge**: skip existing dest unless `opts.force`; never delete. `opts = { force, dryRun, fs, log }`. `fs` defaults to `node:fs/promises`. `log(kind, path)` is optional.
  - `writeText(path, content, opts) -> action` — `opts = { mode, dryRun, fs, log }`.
- The in-memory mock `fs` shape used in tests must implement: `lstat`, `readdir`, `mkdir`, `copyFile`, `writeFile`, `readFile`, `chmod` (all async).

- [ ] **Step 1: Write the failing test**

```js
// config-sync/tests/fs-util.test.mjs
import { test, expect } from 'bun:test';
import { copyTree, writeText } from '../lib/fs-util.js';

// Minimal in-memory fs mock.
function mockFs(tree) {
  const store = new Map(Object.entries(tree));
  const api = {
    async lstat(p) { if (!store.has(p)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; } return { isDirectory: () => p.endsWith('/') }; },
    async readdir(p) { return [...store.keys()].filter(k => k.startsWith(p)).map(k => k.slice(p.length).split('/')[0].replace(/\/$/, '')).filter(Boolean); },
    async mkdir() {},
    async copyFile(src, dest) { store.set(dest, store.get(src)); },
    async writeFile(p, c) { store.set(p, c); },
    async readFile(p) { if (!store.has(p)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; } return store.get(p); },
    async chmod() {},
    _dump: () => Object.fromEntries(store),
  };
  return api;
}

test('copyTree copies a file when dest missing', async () => {
  // Arrange
  const fs = mockFs({ '/s/file.txt': 'hello' });
  // Act
  const actions = await copyTree('/s/file.txt', '/d/file.txt', { fs });
  // Assert
  expect(actions[0].action).toBe('write');
  expect(fs._dump()['/d/file.txt']).toBe('hello');
});

test('copyTree skips existing dest without force (merge)', async () => {
  const fs = mockFs({ '/s/f': 'new', '/d/f': 'existing' });
  const actions = await copyTree('/s/f', '/d/f', { fs });
  expect(actions[0].action).toBe('skip');
  expect(fs._dump()['/d/f']).toBe('existing');
});

test('copyTree overwrites with force', async () => {
  const fs = mockFs({ '/s/f': 'new', '/d/f': 'existing' });
  await copyTree('/s/f', '/d/f', { fs, force: true });
  expect(fs._dump()['/d/f']).toBe('new');
});

test('copyTree dryRun writes nothing', async () => {
  const fs = mockFs({ '/s/f': 'new' });
  await copyTree('/s/f', '/d/f', { fs, dryRun: true });
  expect(fs._dump()['/d/f']).toBeUndefined();
});

test('writeText writes and applies mode', async () => {
  const fs = mockFs({});
  await writeText('/d/out.txt', 'x', { fs, mode: '0600' });
  expect(fs._dump()['/d/out.txt']).toBe('x');
});
```

> Note: the toy mock above is sufficient for behavior assertions. If a maintainer extends it, keep it dependency-free.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd config-sync && bun test tests/fs-util.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// config-sync/lib/fs-util.js
import { resolve, dirname } from 'node:path';

async function defaultFs() { return (await import('node:fs/promises')); }
async function exists(p, fs) { try { await fs.lstat(p); return true; } catch { return false; } }

export async function copyTree(srcAbs, destAbs, opts = {}) {
  const fs = opts.fs || await defaultFs();
  const log = opts.log || (() => {});
  const actions = [];
  const stat = await fs.lstat(srcAbs);
  if (stat.isDirectory()) {
    await fs.mkdir(destAbs, { recursive: true });
    for (const entry of await fs.readdir(srcAbs)) {
      const sub = await copyTree(resolve(srcAbs, entry), resolve(destAbs, entry), opts);
      actions.push(...sub);
    }
    return actions;
  }
  const destExists = await exists(destAbs, fs);
  if (destExists && !opts.force) {
    log('skip', destAbs);
    actions.push({ action: 'skip', dest: destAbs });
    return actions;
  }
  if (opts.dryRun) { log('write', destAbs); actions.push({ action: 'write', dest: destAbs }); return actions; }
  await fs.mkdir(dirname(destAbs), { recursive: true });
  await fs.copyFile(srcAbs, destAbs);
  log('write', destAbs);
  actions.push({ action: 'write', dest: destAbs });
  return actions;
}

export async function writeText(path, content, opts = {}) {
  const fs = opts.fs || await defaultFs();
  const log = opts.log || (() => {});
  if (opts.dryRun) { log('write', path); return { action: 'write', dest: path }; }
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content, 'utf8');
  if (opts.mode) await fs.chmod(path, parseInt(opts.mode, 8));
  log('write', path);
  return { action: 'write', dest: path };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd config-sync && bun test tests/fs-util.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add config-sync/lib/fs-util.js config-sync/tests/fs-util.test.mjs
git commit -m "✨ feat(config-sync): add injectable copy/merge fs utilities"
git push
```

---

## Task 7: Restore CLI (`install.mjs`)

**Files:**
- Create: `config-sync/install.mjs`
- Test: `config-sync/tests/install.test.mjs`

**Interfaces:**
- Consumes: `lib/manifest.js` (`loadManifest`, `resolveDest`), `lib/env.js` (`loadEnvFile`), `lib/render.js` (`renderTemplate`), `lib/fs-util.js` (`copyTree`, `writeText`).
- Produces: `runInstall({ argv, cwd, home, envFile, fs, stdout }) -> exitCode`. CLI `main()` calls it with real deps.

**Behavior:**
- Flags: `--dry-run`, `--force`, `--symlink`, `--allow-missing`.
- Build `placeholders`: `HOME = home.split(sep).join('/')` (forward-slash per spec §6) + values from `.env.local`.
- For each manifest target: `file`/`dir` → `copyTree` (or `fs.symlink` when `--symlink` and platform ≠ win32); `template` → read `cwd/src`, `renderTemplate`, then `writeText(dest, rendered, {mode})`.
- If any `missing` placeholders and not `--allow-missing` → print them, exit `2`.
- `--dry-run` prints every planned action, writes nothing.

- [ ] **Step 1: Write the failing test**

```js
// config-sync/tests/install.test.mjs
import { test, expect } from 'bun:test';
import { runInstall } from '../install.mjs';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function setupFixture() {
  const root = mkdtempSync(join(tmpdir(), 'csync-'));
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  mkdirSync(join(root, 'templates', 'claude'), { recursive: true });
  mkdirSync(join(root, 'home', '.claude'), { recursive: true });
  writeFileSync(join(root, 'templates', 'claude', 'settings.json.tmpl'),
    '{"key":"{{CLAUDE_API_KEY}}","home":"{{HOME}}/x"}');
  writeFileSync(join(root, 'home', '.claude', 'statusline.js'), 'module.exports=1;');
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({
    version: 1,
    targets: [
      { src: 'home/.claude/statusline.js', dest: '~/.claude/statusline.js', type: 'file' },
      { src: 'templates/claude/settings.json.tmpl', dest: '~/.claude/settings.json', type: 'template', mode: '0600' },
    ],
  }));
  writeFileSync(join(root, '.env.local'), 'CLAUDE_API_KEY=sk-test123\n');
  return { root, home };
}

test('runInstall renders templates + copies files into home', async () => {
  // Arrange
  const { root, home } = setupFixture();
  const logs = [];
  // Act
  const code = await runInstall({
    argv: [], cwd: root, home, envFile: join(root, '.env.local'),
    fs: await import('node:fs/promises'), stdout: (s) => logs.push(s),
  });
  // Assert
  expect(code).toBe(0);
  expect(existsSync(join(home, '.claude', 'statusline.js'))).toBe(true);
  const rendered = readFileSync(join(home, '.claude', 'settings.json'), 'utf8');
  expect(rendered).toContain('sk-test123');
  expect(rendered).toContain(home.split(/[\\\\/]/).join('/') + '/x'); // forward-slash HOME
});

test('runInstall errors on missing placeholder without --allow-missing', async () => {
  const { root, home } = setupFixture();
  writeFileSync(join(root, '.env.local'), ''); // no CLAUDE_API_KEY
  const code = await runInstall({
    argv: [], cwd: root, home, envFile: join(root, '.env.local'),
    fs: await import('node:fs/promises'), stdout: () => {},
  });
  expect(code).toBe(2);
});

test('runInstall --dry-run writes nothing', async () => {
  const { root, home } = setupFixture();
  await runInstall({
    argv: ['--dry-run'], cwd: root, home, envFile: join(root, '.env.local'),
    fs: await import('node:fs/promises'), stdout: () => {},
  });
  expect(existsSync(join(home, '.claude', 'statusline.js'))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd config-sync && bun test tests/install.test.mjs`
Expected: FAIL — `runInstall` not exported.

- [ ] **Step 3: Write minimal implementation**

```js
// config-sync/install.mjs
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, resolveDest } from './lib/manifest.js';
import { loadEnvFile } from './lib/env.js';
import { renderTemplate } from './lib/render.js';
import { copyTree, writeText } from './lib/fs-util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function runInstall({ argv, cwd, home, envFile, fs, stdout }) {
  const f = fs || (await import('node:fs/promises'));
  const out = stdout || ((s) => console.log(s));
  const opts = {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    symlink: argv.includes('--symlink'),
    allowMissing: argv.includes('--allow-missing'),
    fs: f,
    log: (kind, p) => out(`  ${kind}  ${p}`),
  };

  const manifest = await loadManifest(path.join(cwd, 'manifest.json'), f);
  const env = await loadEnvFile(envFile || path.join(HERE, '.env.local'), f);
  const placeholders = { ...env, HOME: home.split(/[\\/]/).join('/') };

  const allMissing = [];
  for (const t of manifest.targets) {
    const dest = resolveDest(t.dest, home);
    if (t.type === 'file' || t.type === 'dir') {
      const srcAbs = path.resolve(cwd, t.src);
      if (opts.symlink && process.platform !== 'win32' && !opts.dryRun) {
        await f.mkdir(path.dirname(dest), { recursive: true });
        try { await f.unlink(dest); } catch {}
        await f.symlink(srcAbs, dest);
        out(`  link  ${dest}`);
      } else {
        await copyTree(srcAbs, dest, opts);
      }
    } else if (t.type === 'template') {
      const tmpl = await f.readFile(path.resolve(cwd, t.src), 'utf8');
      const { rendered, missing } = renderTemplate(tmpl, placeholders, { allowMissing: opts.allowMissing });
      allMissing.push(...missing);
      await writeText(dest, rendered, { mode: t.mode, dryRun: opts.dryRun, fs: f, log: opts.log });
    }
  }

  if (allMissing.length && !opts.allowMissing) {
    out(`\nMissing placeholders: ${[...new Set(allMissing)].join(', ')}`);
    out('Fill them in .env.local, or re-run with --allow-missing.');
    return 2;
  }
  out('\nRestore complete. Remember to re-authenticate (Claude /login, codex login).');
  return 0;
}

export async function main() {
  const code = await runInstall({
    argv: process.argv.slice(2),
    cwd: HERE,
    home: os.homedir(),
    fs: await import('node:fs/promises'),
    stdout: (s) => console.log(s),
  });
  process.exit(code);
}

// Run only when invoked directly (not when imported by tests).
import { inspect } from 'node:util';
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('install.mjs')) {
  main();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd config-sync && bun test tests/install.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add config-sync/install.mjs config-sync/tests/install.test.mjs
git commit -m "✨ feat(config-sync): add cross-platform install/restore CLI"
git push
```

---

## Task 8: Capture CLI + template regen (`lib/sync.js`, `sync.mjs`)

**Files:**
- Create: `config-sync/lib/sync.js`
- Create: `config-sync/sync.mjs`
- Test: `config-sync/tests/sync.test.mjs`

**Interfaces:**
- Consumes: `lib/manifest.js`, `lib/fs-util.js` (`copyTree`, `writeText`), `lib/secrets.js` (`scanSecrets`).
- Produces:
  - `TEMPLATE_RULES` — `{ "~/.codex/config.toml": [{match, token}], "~/.claude/settings.json": [...] }`.
  - `regenerateTemplate(liveText, dest, home) -> string` — applies secret rules, then normalizes the live `home` substring (and its forward-slash form) to `{{HOME}}`, flipping adjacent backslashes to `/`.
  - `runSync({ manifest, home, repoRoot, fs, log, refreshSecrets, dryRun }) -> { actions, leaked }` — for `file`/`dir` copies live `dest` → repo `src`; for `template` reads live `dest`, regenerates, writes repo `src`. After writing, scans every written repo file; if `scanSecrets` hits and `!refreshSecrets`, aborts (throws) listing leaks.

- [ ] **Step 1: Write the failing test**

```js
// config-sync/tests/sync.test.mjs
import { test, expect } from 'bun:test';
import { regenerateTemplate, TEMPLATE_RULES, runSync } from '../lib/sync.js';

test('regenerateTemplate redacts codex API key + bearer + home paths', () => {
  // Arrange
  const home = process.platform === 'win32' ? 'C:\\Users\\new_k' : '/home/u';
  const live = `key = "sk-abcd1234567890"\nauth = "Bearer xyztoken123456"\npath = "${home}\\.codex\\run"\n`;
  // Act
  const out = regenerateTemplate(live, '~/.codex/config.toml', home);
  // Assert
  expect(out).toContain('{{CODEX_API_KEY}}');
  expect(out).toContain('{{CODEX_BEARER}}');
  expect(out).toContain('{{HOME}}/.codex/run');
  expect(out).not.toContain('sk-abcd');
  expect(out).not.toContain('xyztoken');
});

test('regenerateTemplate redacts claude settings key', () => {
  const out = regenerateTemplate('"key":"sk-abcdefgh12345678"', '~/.claude/settings.json', '/h');
  expect(out).toContain('{{CLAUDE_API_KEY}}');
});

test('runSync aborts when a live secret would leak into a template', async () => {
  // Arrange: a fake fs where the live file still contains a raw secret because
  // TEMPLATE_RULES missed it (simulating an unmapped secret).
  const manifest = { version: 1, targets: [
    { src: 'templates/codex/config.toml.tmpl', dest: '~/.codex/config.toml', type: 'template' },
  ]};
  const liveSecret = 'unused_token = "token_xyzsecret9999_stuff"\n'; // matches token_field rule
  const fs = {
    async lstat() { return { isDirectory: () => false }; },
    async readdir() { return []; },
    async mkdir() {},
    async copyFile() {},
    async readFile(p) { if (p.endsWith('manifest.json')) return JSON.stringify(manifest); return liveSecret; },
    async writeFile(p, c) { this._w = this._w || {}; this._w[p] = c; },
    async chmod() {},
  };
  // Act / Assert
  await expect(runSync({ manifest, home: '/h', repoRoot: '/r', fs, refreshSecrets: false }))
    .rejects.toThrow(/secret/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd config-sync && bun test tests/sync.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// config-sync/lib/sync.js
import path from 'node:path';
import { resolveDest } from './manifest.js';
import { copyTree, writeText } from './fs-util.js';
import { scanSecrets } from './secrets.js';

export const TEMPLATE_RULES = {
  '~/.codex/config.toml': [
    { match: /sk-[A-Za-z0-9_-]{8,}/g, token: 'CODEX_API_KEY' },
    { match: /Bearer\s+[A-Za-z0-9._-]{6,}/g, token: 'CODEX_BEARER' },
  ],
  '~/.claude/settings.json': [
    { match: /sk-[A-Za-z0-9_-]{8,}/g, token: 'CLAUDE_API_KEY' },
  ],
};

export function regenerateTemplate(liveText, dest, home) {
  let out = liveText;
  for (const { match, token } of (TEMPLATE_RULES[dest] || [])) {
    out = out.replace(match, `{{${token}}}`); // match has 'g' flag → replaces all
  }
  if (home) {
    const variants = new Set([home, home.replace(/\\/g, '/')]);
    for (const v of variants) out = out.split(v).join('{{HOME}}'); // literal, no regex escaping
    // Flip backslashes in path remainders that follow {{HOME}} → forward slash.
    out = out.replace(/({{HOME}})(\\[^\s"',}\]]*)/g, (_full, h, rest) => h + rest.replace(/\\/g, '/'));
  }
  return out;
}

export async function runSync({ manifest, home, repoRoot, fs, log, refreshSecrets, dryRun }) {
  const f = fs || (await import('node:fs/promises'));
  const out = log || (() => {});
  const written = []; // repo paths we wrote (to scan afterwards)
  const actions = [];

  for (const t of manifest.targets) {
    const liveAbs = resolveDest(t.dest, home);
    const repoAbs = path.resolve(repoRoot, t.src);
    if (t.type === 'file' || t.type === 'dir') {
      // Reverse copy: live -> repo
      const sub = await copyTree(liveAbs, repoAbs, { force: true, dryRun, fs: f, log: out });
      actions.push(...sub);
      if (!dryRun) written.push(repoAbs);
    } else if (t.type === 'template') {
      let liveText;
      try { liveText = await f.readFile(liveAbs, 'utf8'); }
      catch (e) { if (e.code === 'ENOENT') { out('skip-missing', liveAbs); continue; } throw e; }
      const rendered = regenerateTemplate(liveText, t.dest, home);
      await writeText(repoAbs, rendered, { force: true, dryRun, fs: f, log: out });
      actions.push({ action: 'template', dest: repoAbs });
      if (!dryRun) written.push(repoAbs);
    }
  }

  // Guard: scan everything we just wrote into the repo for residual secrets.
  const leaked = [];
  for (const p of written) {
    let txt;
    try { txt = await f.readFile(p, 'utf8'); } catch { continue; }
    if (p.endsWith('.tmpl') || p.includes(path.sep + 'home' + path.sep) || p.includes('/home/')) {
      const found = scanSecrets(txt);
      if (found.length) leaked.push({ path: p, found });
    }
  }
  if (leaked.length && !refreshSecrets) {
    const msg = leaked.map(l => `${l.path}: ${l.found.map(x => x.kind).join(',')}`).join('\n');
    throw new Error(`Refusing to sync — residual secret(s) detected. Review TEMPLATE_RULES or re-run with --refresh-secrets only if intentional:\n${msg}`);
  }
  return { actions, leaked };
}
```

```js
// config-sync/sync.mjs  (thin CLI wrapper)
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest } from './lib/manifest.js';
import { runSync } from './lib/sync.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

const manifest = await loadManifest(path.join(HERE, 'manifest.json'), await import('node:fs/promises'));
try {
  const { actions, leaked } = await runSync({
    manifest,
    home: os.homedir(),
    repoRoot: HERE,
    fs: await import('node:fs/promises'),
    log: (kind, p) => console.log(`  ${kind}  ${p}`),
    refreshSecrets: argv.includes('--refresh-secrets'),
    dryRun: argv.includes('--dry-run'),
  });
  console.log(`\nSynced ${actions.length} entr${actions.length === 1 ? 'y' : 'ies'}.`);
  if (leaked.length) console.log(`Note: ${leaked.length} file(s) contained residual secrets (--refresh-secrets used).`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd config-sync && bun test tests/sync.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add config-sync/lib/sync.js config-sync/sync.mjs config-sync/tests/sync.test.mjs
git commit -m "✨ feat(config-sync): add reverse capture CLI with secret guard"
git push
```

---

## Task 9: Manifest data + `.env.example`

**Files:**
- Create: `config-sync/manifest.json`
- Create: `config-sync/.env.example`

**Interfaces:** none (data). Must match the `lib/manifest.js` schema and the include list in spec §3.

- [ ] **Step 1: Write `manifest.json` with the full portable target list**

```json
{
  "version": 1,
  "targets": [
    { "src": "home/.claude/statusline.js",                  "dest": "~/.claude/statusline.js",        "type": "file" },
    { "src": "home/.claude/hooks",                           "dest": "~/.claude/hooks",                "type": "dir" },
    { "src": "home/.claude/skills",                          "dest": "~/.claude/skills",               "type": "dir" },
    { "src": "home/.claude/commands",                        "dest": "~/.claude/commands",             "type": "dir" },
    { "src": "home/.claude/workflows",                       "dest": "~/.claude/workflows",            "type": "dir" },
    { "src": "home/.claude/scripts",                         "dest": "~/.claude/scripts",              "type": "dir" },
    { "src": "home/.claude/skill-overrides",                 "dest": "~/.claude/skill-overrides",      "type": "dir" },
    { "src": "home/.claude/.remember",                       "dest": "~/.claude/.remember",            "type": "dir" },
    { "src": "home/.claude/plugins/installed_plugins.json",  "dest": "~/.claude/plugins/installed_plugins.json", "type": "file" },
    { "src": "home/.claude/plugins/known_marketplaces.json", "dest": "~/.claude/plugins/known_marketplaces.json","type": "file" },
    { "src": "home/.claude/plugins/blocklist.json",          "dest": "~/.claude/plugins/blocklist.json","type": "file" },
    { "src": "templates/claude/settings.json.tmpl",          "dest": "~/.claude/settings.json",        "type": "template", "mode": "0600" },

    { "src": "home/.codex/AGENTS.md",        "dest": "~/.codex/AGENTS.md",        "type": "file" },
    { "src": "home/.codex/hooks.json",       "dest": "~/.codex/hooks.json",       "type": "file" },
    { "src": "home/.codex/keybindings.json", "dest": "~/.codex/keybindings.json", "type": "file" },
    { "src": "home/.codex/version.json",     "dest": "~/.codex/version.json",     "type": "file" },
    { "src": "home/.codex/memories",         "dest": "~/.codex/memories",         "type": "dir" },
    { "src": "home/.codex/skills",           "dest": "~/.codex/skills",           "type": "dir" },
    { "src": "home/.codex/rules",            "dest": "~/.codex/rules",            "type": "dir" },
    { "src": "templates/codex/config.toml.tmpl", "dest": "~/.codex/config.toml",  "type": "template", "mode": "0600" },

    { "src": "home/.agents/skills",            "dest": "~/.agents/skills",            "type": "dir" },
    { "src": "home/.agents/skills-disabled",   "dest": "~/.agents/skills-disabled",   "type": "dir" },
    { "src": "home/.agents/.skill-lock.json",  "dest": "~/.agents/.skill-lock.json",  "type": "file" },
    { "src": "home/.agents/plugins",           "dest": "~/.agents/plugins",           "type": "dir" }
  ]
}
```

- [ ] **Step 2: Write `.env.example`**

```bash
# Copy to .env.local and fill in. .env.local is gitignored.
# Where to find each: Claude/Codex provider dashboards or your existing ~/.codex/config.toml & ~/.claude/settings.json.

CLAUDE_API_KEY=sk-replace-me
CODEX_API_KEY=sk-replace-me
CODEX_BEARER=replace-me
```

- [ ] **Step 3: Validate the manifest loads**

Run: `cd config-sync && bun -e "import('./lib/manifest.js').then(async m=>{const x=await m.loadManifest('manifest.json');console.log('targets:',x.targets.length)})"`
Expected: `targets: 24` (prints the count, no validation errors).

- [ ] **Step 4: Commit**

```bash
git add config-sync/manifest.json config-sync/.env.example
git commit -m "🔧 chore(config-sync): add manifest targets + env example"
git push
```

---

## Task 10: Capture live config + generate templates

**Files:**
- Populate: `config-sync/home/**` (via `sync.mjs`)
- Generate: `config-sync/templates/claude/settings.json.tmpl`, `config-sync/templates/codex/config.toml.tmpl`

**Interfaces:** consumes `sync.mjs` (Task 8) + `manifest.json` (Task 9).

> **Care:** this task reads your LIVE `~/.claude/settings.json` and `~/.codex/config.toml` (which contain real secrets) and must write ONLY redacted templates into the repo. The secret guard from Task 8 is the safety net — do not bypass it. Run `--dry-run` first and eyeball the diff.

- [ ] **Step 1: Dry-run the capture and review planned actions**

Run: `cd config-sync && node sync.mjs --dry-run`
Expected: lists every `write`/`template` action (live → repo). No writes occur.

- [ ] **Step 2: Run the real capture**

Run: `cd config-sync && node sync.mjs`
Expected: completes with `Synced N entries.` and **no** "residual secret" error. If it errors, inspect the named file — add a rule to `TEMPLATE_RULES` (Task 8) for the unmapped secret, re-run.

- [ ] **Step 3: Verify NO secret leaked into tracked content**

Run: `cd config-sync && bun -e "import('./lib/secrets.js').then(async s=>{const f=await import('node:fs/promises');const p=await f.readFile('templates/codex/config.toml.tmpl','utf8');console.log('codex leaks:',s.scanSecrets(p).length);const q=await f.readFile('templates/claude/settings.json.tmpl','utf8');console.log('claude leaks:',s.scanSecrets(q).length)})"`
Expected: `codex leaks: 0` and `claude leaks: 0`.

- [ ] **Step 4: Spot-check the generated templates contain placeholders**

Run (Git Bash): `grep -E "CODEX_API_KEY|CODEX_BEARER|CLAUDE_API_KEY|HOME" config-sync/templates/codex/config.toml.tmpl config-sync/templates/claude/settings.json.tmpl | head -20`
Expected: lines showing `{{CODEX_API_KEY}}`, `{{CODEX_BEARER}}`, `{{HOME}}`, `{{CLAUDE_API_KEY}}`.

- [ ] **Step 5: Verify V1 (forward-slash HOME) — manual check**

Open `templates/codex/config.toml.tmpl`; confirm path values read like `{{HOME}}/.codex/…` (forward slashes), not `{{HOME}}\.codex`. Record the result in Task 12. (If any path still has a backslash after `{{HOME}}`, widen the regex in `regenerateTemplate` and re-run Step 2.)

- [ ] **Step 6: Confirm `.env.local` is NOT staged**

Run: `cd config-sync && git status --short && git check-ignore .env.local || true`
Expected: `.env.local` either absent or listed as ignored (never staged). Staged files should be under `home/` and `templates/` only.

- [ ] **Step 7: Commit the captured portable config**

```bash
git add config-sync/home config-sync/templates
git commit -m "✨ feat(config-sync): capture live portable config + templated secrets"
git push
```

---

## Task 11: README + CI secret-scan workflow

**Files:**
- Create: `config-sync/README.md`
- Create: `.github/workflows/secret-scan.yml`

- [ ] **Step 1: Write `config-sync/README.md`**

```markdown
# config-sync

Cross-platform backup/restore for Claude Code, Codex, and `.agents` global config.

## Restore on a new device

```bash
git clone <this-repo>
cd claude-code-plugins/config-sync
cp .env.example .env.local        # then edit .env.local with your keys
bun install                       # optional; node works too
node install.mjs --dry-run        # preview
node install.mjs                  # apply (add --force to overwrite, --symlink on macOS/Linux)
```

Then re-authenticate once: Claude Code `/login`, Codex `codex login`.

## Capture changes back into the repo

```bash
cd config-sync
node sync.mjs --dry-run           # preview
node sync.mjs                     # writes portable copies + redacted templates
```

`sync.mjs` refuses to commit any residual secret. Add `--refresh-secrets` only if you intentionally changed which values are redacted.

## What is / isn't synced

- **Synced:** hooks, skills, commands, workflows, statusline, plugin registry, AGENTS.md/config.toml (templated), memories.
- **Never synced:** OAuth creds (`auth.json`, `.credentials.json`), plugin download cache, transcripts/sessions, sqlite logs, worktrees.

Secret-bearing files are stored as `templates/*.tmpl` with `{{TOKEN}}`; real files are gitignored and rendered on install from `.env.local`.
```

- [ ] **Step 2: Write the CI secret-scan workflow**

```yaml
# .github/workflows/secret-scan.yml
name: secret-scan
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Scan tracked files for secrets
        working-directory: config-sync
        run: |
          bun -e "
            import('./lib/secrets.js').then(async ({ scanSecrets }) => {
              const { execSync } = require('node:child_process');
              const files = execSync('git ls-files', { cwd: '..' }).toString().trim().split('\n')
                .filter(f => /\.(toml|json|js|mjs|md|tmpl|txt)$/i.test(f));
              let bad = 0;
              for (const f of files) {
                const { readFileSync } = require('node:fs');
                let txt; try { txt = readFileSync('../' + f, 'utf8'); } catch { continue; }
                const hits = scanSecrets(txt);
                if (hits.length) { bad++; console.log(f, JSON.stringify(hits)); }
              }
              if (bad) process.exit(1);
            });
          "
```

> Note: the inline `bun -e` keeps it dependency-free. (If Bun's CJS/ESM interop complains, refactor to a small `config-sync/scripts/ci-scan.mjs` and call `bun run scripts/ci-scan.mjs` — same logic.)

- [ ] **Step 3: Lint-check the YAML locally (if yq available) — otherwise skip**

Run: `cd ".." && (command -v yq >/dev/null && yq '.jobs.scan.steps[2].run' .github/workflows/secret-scan.yml || echo "yq not installed; skipping")`
Expected: either the run string or "yq not installed; skipping".

- [ ] **Step 4: Commit**

```bash
git add config-sync/README.md .github/workflows/secret-scan.yml
git commit -m "📝 docs(config-sync): add README + CI secret-scan workflow"
git push
```

---

## Task 12: Final verification + finish branch

**Files:** none (verification + merge).

- [ ] **Step 1: Full test suite passes**

Run: `cd config-sync && bun test`
Expected: all tests PASS across `secrets`, `render`, `env`, `manifest`, `fs-util`, `install`, `sync`.

- [ ] **Step 2: Lint with eslint (per CLAUDE.md atomic workflow)**

Run: `cd config-sync && bunx eslint lib/*.js *.mjs tests/*.mjs 2>/dev/null || echo "no eslint config; skipping (zero-dep project)"`
Expected: clean, or "no eslint config; skipping".

- [ ] **Step 3: End-to-end restore into a throwaway HOME**

Run (Git Bash):
```bash
cd config-sync
TMPHOME=$(mktemp -d)
node install.mjs --dry-run --home "$TMPHOME" 2>/dev/null || true   # preview if --home supported; else skip
# Real run against temp home via a one-off env override:
HOME="$TMPHOME" node -e "import('./install.mjs').then(async m=>await m.runInstall({argv:[],cwd:process.cwd(),home:process.env.HOME,envFile:require('path').join(process.cwd(),'.env.local'),fs:await import('node:fs/promises'),stdout:console.log})).then(c=>process.exit(c))"
ls -la "$TMPHOME/.claude" "$TMPHOME/.codex" "$TMPHOME/.agents"
rm -rf "$TMPHOME"
```
Expected: temp home contains the restored `.claude`, `.codex`, `.agents` entries; rendered `settings.json`/`config.toml` contain the `.env.local` values. (Adjust if `install.mjs` doesn't accept a `--home` flag — the inline `runInstall` call passes `home` directly, which is the tested path.)

- [ ] **Step 4: Confirm verification items from the spec**

- **V1:** forward-slash `{{HOME}}` accepted by Codex on Windows — recorded in Task 10 Step 5. If Codex rejected `/`, document the per-entry exception here.
- **V2:** plugin auto-restore — after restore, launch Claude Code and confirm enabled plugins repopulate from `installed_plugins.json` + `known_marketplaces.json`. If not, add the explicit `/plugin install` step to `README.md` (Task 11) and note here.
- **V3:** notify-sounds excluded — confirm `manifest.json` has no notify-sounds entry (it doesn't). ✓

- [ ] **Step 5: Open a PR for `feat/config-sync`**

Run:
```bash
gh pr create --title "✨ feat: cross-platform config-sync (Claude Code + Codex + .agents)" \
  --body "Backup/restore global config across devices. See docs/specs/2026-07-25-config-sync-design.md and docs/plans/2026-07-25-config-sync.md. Secrets templated; machine-state excluded; CI secret-scan added."
```
Expected: PR URL printed.

- [ ] **Step 6: After merge, clean up**

Run: `cd "../.." && git worktree remove .claude/worktrees/config-sync && git branch -d feat/config-sync`
Expected: worktree removed, local branch deleted (after the PR merges).

---

## Self-Review Notes (applied)

- **Worktree:** `.claude/worktrees/config-sync` (`feat/config-sync`) — confirmed via `git worktree list`.
- **Spec coverage:** include/exclude (Tasks 9–10), templating (3, 7, 8), `{{HOME}}` forward-slash (3, 7, 8, 10), hybrid install copy/symlink (7), reverse sync + guard (8), plugin registry (9, 12-V2), CI secret scan (11), tests AAA (2–8). V1/V2/V3 verified in Task 12.
- **Type consistency:** `runInstall`, `runSync`, `renderTemplate`, `loadManifest`, `resolveDest`, `copyTree`, `writeText`, `regenerateTemplate`, `scanSecrets` signatures match across producer/consumer tasks.
- **No placeholders:** all steps contain real code or real commands.

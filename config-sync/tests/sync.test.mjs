// config-sync/tests/sync.test.mjs
import { test, expect } from 'bun:test';
import { regenerateTemplate, TEMPLATE_RULES, runSync } from '../lib/sync.js';

// --- regenerateTemplate: pure-function redaction ---

test('regenerateTemplate redacts codex API key + bearer + home paths', () => {
  // Arrange — live codex config carrying an sk- key, a Bearer token, and a home
  // path in native form. TEMPLATE_RULES must redact both secrets and the home
  // substring must collapse to {{HOME}} with backslashes flipped to forward slash.
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
  // Arrange — claude settings JSON with an sk- key; home is harmless short '/h'.
  const live = '"key":"sk-abcdefgh12345678"';
  // Act
  const out = regenerateTemplate(live, '~/.claude/settings.json', '/h');
  // Assert
  expect(out).toContain('{{CLAUDE_API_KEY}}');
});

// --- runSync: source-side secret guard (safety-critical) ---
//
// The guard scans every target's SOURCE before any disk write. A detectable
// secret never reaches a tracked file for any target type (template/file/dir)
// unless --refresh-secrets is set. Minimal injectable fs: live files are keyed
// by normalized live paths (forward-slash, drive-stripped); a path is a directory
// when other entries live beneath it (no marker needed). `writeFile`/`copyFile`
// are recorded so tests can PROVE a leaking target was never written.

function mockFs(liveFiles) {
  const norm = p => String(p).replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
  const strip = p => p.replace(/\/+$/, '');
  const entries = Object.entries(liveFiles).map(([k, v]) => [strip(norm(k)), v]);
  const written = new Map();
  const isDir = key => entries.some(([e]) => e.startsWith(strip(key) + '/'));
  const findFile = key => entries.find(([e]) => e === strip(norm(key)));
  return {
    _written: written,
    async lstat(p) {
      const key = strip(norm(p));
      if (isDir(key)) return { isDirectory: () => true };
      if (findFile(key)) return { isDirectory: () => false };
      const err = new Error('ENOENT'); err.code = 'ENOENT'; throw err;
    },
    async readdir(p) {
      const prefix = strip(norm(p)) + '/';
      const kids = new Set();
      for (const [e] of entries) if (e.startsWith(prefix)) {
        const seg = e.slice(prefix.length).split('/')[0];
        if (seg) kids.add(seg);
      }
      return [...kids];
    },
    async mkdir() {},
    async copyFile(src, dest) { const f = findFile(norm(src)); written.set(strip(norm(dest)), f ? f[1] : ''); },
    async writeFile(p, c) { written.set(strip(norm(p)), c); },
    async readFile(p) {
      const key = norm(p);
      if (written.has(strip(key))) return written.get(strip(key));
      const f = findFile(key);
      if (f) return f[1];
      const err = new Error('ENOENT'); err.code = 'ENOENT'; throw err;
    },
    async chmod() {},
  };
}

test('runSync aborts when a live secret would leak into a template', async () => {
  // Arrange — a token_field secret TEMPLATE_RULES does NOT cover (only sk- and
  // Bearer are mapped for ~/.codex/config.toml), so it survives regenerateTemplate
  // and must be caught by the IN-MEMORY pre-scan BEFORE any disk write.
  const manifest = { version: 1, targets: [
    { src: 'templates/codex/config.toml.tmpl', dest: '~/.codex/config.toml', type: 'template' },
  ]};
  const liveSecret = 'config = { "api_key": "liveplaintextsecret123" }\n';
  const fs = mockFs({ '/h/.codex/config.toml': liveSecret });
  // Act
  let threw = false;
  try { await runSync({ manifest, home: '/h', repoRoot: '/r', fs, refreshSecrets: false }); }
  catch { threw = true; }
  // Assert — guard fired AND the leaking file never reached disk (pre-scan held it).
  expect(threw).toBe(true);
  expect(fs._written.size).toBe(0);
});

test('runSync writes a clean template and reports no leaks', async () => {
  // Arrange — live config whose secret IS fully covered by TEMPLATE_RULES; after
  // regeneration the rendered text is clean and safe to commit.
  const manifest = { version: 1, targets: [
    { src: 'templates/codex/config.toml.tmpl', dest: '~/.codex/config.toml', type: 'template' },
  ]};
  const live = 'key = "sk-abcd1234567890"\n';
  const fs = mockFs({ '/h/.codex/config.toml': live });
  // Act
  const { actions, leaked } = await runSync({ manifest, home: '/h', repoRoot: '/r', fs });
  // Assert — template written, sk- redacted to {{CODEX_API_KEY}}, no residual leak.
  expect(leaked).toEqual([]);
  expect(actions[0].action).toBe('template');
  const written = [...fs._written.values()].join('');
  expect(written).toContain('{{CODEX_API_KEY}}');
  expect(written).not.toContain('sk-abcd');
});

test('runSync refreshSecrets writes the leaking template and reports it', async () => {
  // Arrange — same unmapped token_field secret, but refreshSecrets opts into the
  // documented escape hatch: write through and surface the leak for review.
  const manifest = { version: 1, targets: [
    { src: 'templates/codex/config.toml.tmpl', dest: '~/.codex/config.toml', type: 'template' },
  ]};
  const liveSecret = 'config = { "api_key": "liveplaintextsecret123" }\n';
  const fs = mockFs({ '/h/.codex/config.toml': liveSecret });
  // Act
  const { leaked } = await runSync({ manifest, home: '/h', repoRoot: '/r', fs, refreshSecrets: true });
  // Assert — file WAS written this time (escape hatch) and the leak is reported once.
  expect(leaked.length).toBe(1);
  expect(leaked[0].found[0].kind).toBe('token_field');
  expect([...fs._written.keys()]).toContain('/r/templates/codex/config.toml.tmpl');
});

test('runSync pre-scans file targets and skips copy when source leaks', async () => {
  // Arrange — a `file` target whose LIVE source carries a raw sk- key. The
  // source-side pre-scan must skip copyTree entirely so the secret never reaches
  // a tracked file, then abort.
  const manifest = { version: 1, targets: [
    { src: 'static/codex-snippet.sh', dest: '~/.codex/snippet.sh', type: 'file' },
  ]};
  const fs = mockFs({ '/h/.codex/snippet.sh': 'export KEY=sk-leaked1234567890\n' });
  // Act
  let threw = false;
  try { await runSync({ manifest, home: '/h', repoRoot: '/r', fs, refreshSecrets: false }); }
  catch { threw = true; }
  // Assert — guard fired AND copyTree never ran (no repo file on disk).
  expect(threw).toBe(true);
  expect(fs._written.size).toBe(0);
});

test('runSync pre-scans dir targets and skips the whole dir when a leaf leaks', async () => {
  // Arrange — a `dir` target with one clean leaf and one leaf carrying a
  // token_field secret. scanTreeLeak must walk every leaf, find the leak, and
  // skip copying the entire directory so the secret-bearing file is never written.
  const manifest = { version: 1, targets: [
    { src: 'static/agents/', dest: '~/.codex/agents/', type: 'dir' },
  ]};
  const fs = mockFs({
    '/h/.codex/agents/a.md': 'just clean markdown, no secrets',
    '/h/.codex/agents/b.json': '{"api_key": "supersecretvalue123"}',
  });
  // Act
  let threw = false;
  try { await runSync({ manifest, home: '/h', repoRoot: '/r', fs, refreshSecrets: false }); }
  catch { threw = true; }
  // Assert — guard fired AND no leaf of the dir reached disk.
  expect(threw).toBe(true);
  expect(fs._written.size).toBe(0);
});

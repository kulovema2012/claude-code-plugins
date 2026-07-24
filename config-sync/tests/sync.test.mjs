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

// --- runSync: secret guard (safety-critical) ---
//
// Minimal injectable fs. Live files are keyed by path SUFFIX so the same mock
// works cross-platform (resolveDest yields platform-native paths). `writeFile`
// records every call so tests can PROVE a leaking template never reached disk.

function mockFs(liveFiles) {
  // Normalize to forward-slash + drive-stripped so the same mock works on win32
  // (path.resolve yields drive-prefixed backslash paths) and POSIX.
  const norm = p => String(p).replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
  const written = new Map();
  const findLive = key => Object.entries(liveFiles).find(([suf]) => key.endsWith(norm(suf)));
  return {
    _written: written,
    async lstat() { return { isDirectory: () => false }; },
    async readdir() { return []; },
    async mkdir() {},
    async copyFile(src, dest) { const e = findLive(norm(src)); written.set(norm(dest), e ? e[1] : ''); },
    async writeFile(p, c) { written.set(norm(p), c); },
    async readFile(p) {
      const key = norm(p);
      if (written.has(key)) return written.get(key);
      const e = findLive(key);
      if (e) return e[1];
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
  const fs = mockFs({ '.codex/config.toml': liveSecret });
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
  const fs = mockFs({ '.codex/config.toml': live });
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
  const fs = mockFs({ '.codex/config.toml': liveSecret });
  // Act
  const { leaked } = await runSync({ manifest, home: '/h', repoRoot: '/r', fs, refreshSecrets: true });
  // Assert — file WAS written this time (escape hatch) and the leak is reported once.
  expect(leaked.length).toBe(1);
  expect(leaked[0].found[0].kind).toBe('token_field');
  expect([...fs._written.keys()]).toContain('/r/templates/codex/config.toml.tmpl');
});

test('runSync post-scans file targets and aborts on residual secret', async () => {
  // Arrange — a `file` target (verbatim copy, no template regeneration) carrying
  // a raw sk- key. file/dir targets cannot be pre-rendered, so the post-write
  // guard catches it and refuses the sync (the write happens, but the abort
  // prevents a silent commit).
  const manifest = { version: 1, targets: [
    { src: 'static/codex-snippet.sh', dest: '~/.codex/snippet.sh', type: 'file' },
  ]};
  const fs = mockFs({ '.codex/snippet.sh': 'export KEY=sk-leaked1234567890\n' });
  // Act
  let threw = false;
  try { await runSync({ manifest, home: '/h', repoRoot: '/r', fs, refreshSecrets: false }); }
  catch { threw = true; }
  // Assert
  expect(threw).toBe(true);
});

// Integration tests for the restore CLI (install.mjs). These exercise the full
// runInstall pipeline against a real node:fs temp directory so we assert
// actual side effects (file copies, rendered template content, exit codes).
// The direct-invocation guard in install.mjs must keep these tests from
// triggering main() on import — we import runInstall only.

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
  // Arrange — fixture with one file target and one template target.
  const { root, home } = setupFixture();
  const logs = [];
  // Act
  const code = await runInstall({
    argv: [], cwd: root, home, envFile: join(root, '.env.local'),
    fs: await import('node:fs/promises'), stdout: (s) => logs.push(s),
  });
  // Assert — exit 0, file copied verbatim, template rendered with env + forward-slash HOME.
  expect(code).toBe(0);
  expect(existsSync(join(home, '.claude', 'statusline.js'))).toBe(true);
  const rendered = readFileSync(join(home, '.claude', 'settings.json'), 'utf8');
  expect(rendered).toContain('sk-test123');
  expect(rendered).toContain(home.split(/[\\/]/).join('/') + '/x'); // forward-slash HOME
});

test('runInstall errors on missing placeholder without --allow-missing', async () => {
  // Arrange — .env.local emptied so CLAUDE_API_KEY is unresolved.
  const { root, home } = setupFixture();
  writeFileSync(join(root, '.env.local'), ''); // no CLAUDE_API_KEY
  // Act
  const code = await runInstall({
    argv: [], cwd: root, home, envFile: join(root, '.env.local'),
    fs: await import('node:fs/promises'), stdout: () => {},
  });
  // Assert — missing placeholder surfaces as exit code 2.
  expect(code).toBe(2);
});

test('runInstall --dry-run writes nothing', async () => {
  // Arrange — fixture ready; dryRun must perform zero writes.
  const { root, home } = setupFixture();
  // Act
  await runInstall({
    argv: ['--dry-run'], cwd: root, home, envFile: join(root, '.env.local'),
    fs: await import('node:fs/promises'), stdout: () => {},
  });
  // Assert — home tree untouched.
  expect(existsSync(join(home, '.claude', 'statusline.js'))).toBe(false);
});

// --- Task 10 phase 2a: symlinks-target restore (mock fs, Windows-symlink-safe) ---
//
// Restoring a symlinks target reads the repo sidecar JSON and recreates each
// link at dest pointing at home + the stored home-relative target. These tests
// inject an in-memory fs so they run cross-platform without the Windows
// SeCreateSymbolicLinkPrivilege requirement that real-fs symlink tests need.
const normPath = p => String(p).replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
function mockFs(files) {
  const store = new Map();
  for (const [k, v] of Object.entries(files)) store.set(normPath(k), v);
  const links = new Map();
  return {
    _links: links,
    async readFile(p) { const np = normPath(p); if (store.has(np)) return store.get(np); const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; },
    async writeFile(p, c) { store.set(normPath(p), String(c)); },
    async lstat(p) { const np = normPath(p); if (links.has(np)) return { isDirectory: () => false, isSymbolicLink: () => true }; if (store.has(np)) return { isDirectory: () => false, isSymbolicLink: () => false }; const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; },
    async mkdir() {},
    async symlink(target, p) { links.set(normPath(p), normPath(target)); },
    async unlink(p) { const np = normPath(p); links.delete(np); store.delete(np); },
  };
}

test('runInstall recreates symlinks from a sidecar into home', async () => {
  // Arrange — repo sidecar maps two link names to home-relative targets; the
  // canonical source lives under home. No templates => no missing placeholders.
  const root = '/repo';
  const home = '/h';
  const manifest = {
    version: 1,
    targets: [
      { src: 'home/.claude/skills.links.json', dest: '~/.claude/skills', type: 'symlinks', linkSource: '~/.agents/skills' },
    ],
  };
  const sidecar = JSON.stringify({
    'agent-browser': '.agents/skills/agent-browser',
    'caveman':       '.agents/skills/caveman',
  });
  const fs = mockFs({
    [`${root}/manifest.json`]: JSON.stringify(manifest),
    [`${root}/.env.local`]: '',
    [`${root}/home/.claude/skills.links.json`]: sidecar,
  });
  // Act
  const code = await runInstall({ argv: [], cwd: root, home, envFile: `${root}/.env.local`, fs, stdout: () => {} });
  // Assert — exit 0; each link recreated at dest pointing at home + target.
  expect(code).toBe(0);
  expect(fs._links.get('/h/.claude/skills/agent-browser')).toBe('/h/.agents/skills/agent-browser');
  expect(fs._links.get('/h/.claude/skills/caveman')).toBe('/h/.agents/skills/caveman');
});

test('runInstall --dry-run logs symlinks but creates none', async () => {
  // Arrange — same sidecar; dryRun must report the would-be links only.
  const root = '/repo';
  const home = '/h';
  const manifest = { version: 1, targets: [
    { src: 'home/.claude/skills.links.json', dest: '~/.claude/skills', type: 'symlinks', linkSource: '~/.agents/skills' },
  ]};
  const fs = mockFs({
    [`${root}/manifest.json`]: JSON.stringify(manifest),
    [`${root}/.env.local`]: '',
    [`${root}/home/.claude/skills.links.json`]: JSON.stringify({ 'caveman': '.agents/skills/caveman' }),
  });
  // Act
  await runInstall({ argv: ['--dry-run'], cwd: root, home, envFile: `${root}/.env.local`, fs, stdout: () => {} });
  // Assert — zero links materialized.
  expect(fs._links.size).toBe(0);
});

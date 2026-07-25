import { test, expect } from 'bun:test';
import { copyTree, writeText } from '../lib/fs-util.js';

// Minimal in-memory fs mock. Records mutating calls (mkdir/copyFile/chmod)
// so tests can assert side-effect-free behavior (e.g. dryRun).
//
// Production fs-util.js uses node:path (platform-native), so on Windows
// path.resolve yields drive-prefixed backslash paths (e.g. C:\src\a.txt).
// normalize() converts any incoming path to forward-slash + drive-stripped
// form so the same mock tree works on both Windows and POSIX without imposing
// a path-format contract on the production module.
const normalize = p => String(p).replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
const normActions = actions => actions.map(a => ({ ...a, dest: normalize(a.dest) }));

function mockFs(tree, links = {}) {
  const store = new Map(Object.entries(tree));
  const linkStore = new Map(Object.entries(links));
  const api = {
    _mkdirCalls: [],
    _copyFileCalls: [],
    _chmodCalls: [],
    _symlinkCalls: [],
    async lstat(p) {
      const np = normalize(p);
      if (linkStore.has(np)) return { isDirectory: () => false, isSymbolicLink: () => true };
      if (store.has(np)) return { isDirectory: () => np.endsWith('/'), isSymbolicLink: () => false };
      const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e;
    },
    async readdir(p) { const np = normalize(p); return [...new Set([...store.keys(), ...linkStore.keys()])].filter(k => k.startsWith(np)).map(k => k.slice(np.length).split('/')[0].replace(/\/$/, '')).filter(Boolean); },
    async mkdir(p, opts) { this._mkdirCalls.push([normalize(p), opts]); },
    async copyFile(src, dest) { const ns = normalize(src), nd = normalize(dest); this._copyFileCalls.push([ns, nd]); store.set(nd, store.get(ns)); },
    async writeFile(p, c) { store.set(normalize(p), c); },
    async readFile(p) { const np = normalize(p); if (!store.has(np)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; } return store.get(np); },
    async chmod(p, m) { this._chmodCalls.push([normalize(p), m]); },
    async readlink(p) { const np = normalize(p); if (!linkStore.has(np)) { const e = new Error('EINVAL'); e.code = 'EINVAL'; throw e; } return linkStore.get(np); },
    async symlink(target, p) { const np = normalize(p); this._symlinkCalls.push([normalize(target), np]); linkStore.set(np, normalize(target)); },
    async unlink(p) { const np = normalize(p); linkStore.delete(np); store.delete(np); },
    _dump: () => Object.fromEntries(store),
    _links: () => Object.fromEntries(linkStore),
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
  // Arrange
  const fs = mockFs({ '/s/f': 'new', '/d/f': 'existing' });
  // Act
  const actions = await copyTree('/s/f', '/d/f', { fs });
  // Assert
  expect(actions[0].action).toBe('skip');
  expect(fs._dump()['/d/f']).toBe('existing');
});

test('copyTree overwrites with force', async () => {
  // Arrange
  const fs = mockFs({ '/s/f': 'new', '/d/f': 'existing' });
  // Act
  await copyTree('/s/f', '/d/f', { fs, force: true });
  // Assert
  expect(fs._dump()['/d/f']).toBe('new');
});

test('copyTree dryRun writes nothing but returns the would-be action', async () => {
  // Arrange
  const fs = mockFs({ '/s/f': 'new' });
  // Act
  const actions = await copyTree('/s/f', '/d/f', { fs, dryRun: true });
  // Assert
  expect(fs._dump()['/d/f']).toBeUndefined();
  expect(fs._mkdirCalls).toHaveLength(0);
  expect(fs._copyFileCalls).toHaveLength(0);
  expect(actions).toContainEqual({ action: 'write', dest: '/d/f' });
});

test('copyTree recurses into a directory tree and copies each leaf', async () => {
  // Arrange — '/src/' key (trailing slash) makes lstat report isDirectory=true.
  const fs = mockFs({ '/src/': null, '/src/a.txt': 'A', '/src/b.txt': 'B' });
  // Act
  const actions = await copyTree('/src/', '/dst/', { fs });
  // Assert
  expect(fs._dump()['/dst/a.txt']).toBe('A');
  expect(fs._dump()['/dst/b.txt']).toBe('B');
  expect(normActions(actions)).toContainEqual({ action: 'write', dest: '/dst/a.txt' });
  expect(normActions(actions)).toContainEqual({ action: 'write', dest: '/dst/b.txt' });
});

test('copyTree dryRun on a directory mutates nothing but reports all leaves', async () => {
  // Arrange
  const fs = mockFs({ '/src/': null, '/src/a.txt': 'A', '/src/b.txt': 'B' });
  // Act
  const actions = await copyTree('/src/', '/dst/', { fs, dryRun: true });
  // Assert — zero filesystem side effects.
  expect(fs._mkdirCalls).toHaveLength(0);
  expect(fs._copyFileCalls).toHaveLength(0);
  expect(fs._dump()['/dst/']).toBeUndefined();
  expect(fs._dump()['/dst/a.txt']).toBeUndefined();
  expect(fs._dump()['/dst/b.txt']).toBeUndefined();
  // Still returns the would-be write entries for each leaf.
  expect(normActions(actions)).toContainEqual({ action: 'write', dest: '/dst/a.txt' });
  expect(normActions(actions)).toContainEqual({ action: 'write', dest: '/dst/b.txt' });
});

test('writeText writes and applies mode via chmod with parsed octal', async () => {
  // Arrange
  const fs = mockFs({});
  // Act
  await writeText('/d/out.txt', 'x', { fs, mode: '0600' });
  // Assert
  expect(fs._dump()['/d/out.txt']).toBe('x');
  expect(fs._chmodCalls).toEqual([['/d/out.txt', parseInt('0600', 8)]]);
});

// --- copyTree symlink branch (Task 10 phase 2a: fix EISDIR on symlink farms) ---
//
// copyTree must recreate symlinks (readlink + symlink), NEVER readFile them —
// reading a link that points at a directory is the EISDIR crash. Links honor
// the same dryRun/force/merge contract as regular file copies.

test('copyTree recreates a symlink as a link instead of reading it', async () => {
  // Arrange — /src/ contains one entry, a link 'link' -> /canonical/target.
  const fs = mockFs({ '/src/': null }, { '/src/link': '/canonical/target' });
  // Act
  const actions = await copyTree('/src/', '/dst/', { fs });
  // Assert — one link action with target preserved; link never read/copied.
  expect(fs._symlinkCalls).toEqual([['/canonical/target', '/dst/link']]);
  expect(fs._copyFileCalls).toEqual([]);
  expect(normActions(actions)).toContainEqual({ action: 'link', dest: '/dst/link' });
});

test('copyTree dryRun on a symlink reports the link and creates nothing', async () => {
  // Arrange
  const fs = mockFs({ '/src/': null }, { '/src/link': '/canonical/target' });
  // Act
  const actions = await copyTree('/src/', '/dst/', { fs, dryRun: true });
  // Assert — no link materialized; would-be link action still reported.
  expect(fs._symlinkCalls).toEqual([]);
  expect(normActions(actions)).toContainEqual({ action: 'link', dest: '/dst/link' });
});

test('copyTree skips an existing dest link without force (merge)', async () => {
  // Arrange — dest link already exists pointing elsewhere; without force it survives.
  const fs = mockFs({}, { '/src/link': '/canonical/target', '/dst/link': '/existing/target' });
  // Act
  const actions = await copyTree('/src/link', '/dst/link', { fs });
  // Assert
  expect(actions[0].action).toBe('skip');
  expect(fs._symlinkCalls).toEqual([]);
  expect(fs._links()['/dst/link']).toBe('/existing/target');
});

test('copyTree overwrites an existing dest link when force is set', async () => {
  // Arrange — dest link exists pointing at /old/target; force must replace it.
  const fs = mockFs({}, { '/src/link': '/canonical/target', '/dst/link': '/old/target' });
  // Act
  const actions = await copyTree('/src/link', '/dst/link', { fs, force: true });
  // Assert — old link replaced, new link points at the source target.
  expect(actions[0].action).toBe('link');
  expect(fs._symlinkCalls).toEqual([['/canonical/target', '/dst/link']]);
  expect(fs._links()['/dst/link']).toBe('/canonical/target');
});

test('copyTree with skipSymlinks drops symlink entries entirely', async () => {
  // Arrange — /src/ holds a real file and a symlink. With skipSymlinks the link
  // is skipped (no copy, no recreate, no action) — its structure is captured
  // separately by a paired `symlinks` target during hybrid mixed-dir capture.
  const fs = mockFs({ '/src/': null, '/src/real.txt': 'data' }, { '/src/link': '/canonical/target' });
  // Act
  const actions = await copyTree('/src/', '/dst/', { fs, skipSymlinks: true });
  // Assert — real file copied; symlink untouched (no call, no action).
  expect(fs._dump()['/dst/real.txt']).toBe('data');
  expect(fs._symlinkCalls).toEqual([]);
  expect(actions.find(a => a.action === 'link')).toBeUndefined();
});

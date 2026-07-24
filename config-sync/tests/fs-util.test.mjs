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

function mockFs(tree) {
  const store = new Map(Object.entries(tree));
  const api = {
    _mkdirCalls: [],
    _copyFileCalls: [],
    _chmodCalls: [],
    async lstat(p) { const np = normalize(p); if (!store.has(np)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; } return { isDirectory: () => np.endsWith('/') }; },
    async readdir(p) { const np = normalize(p); return [...store.keys()].filter(k => k.startsWith(np)).map(k => k.slice(np.length).split('/')[0].replace(/\/$/, '')).filter(Boolean); },
    async mkdir(p, opts) { this._mkdirCalls.push([normalize(p), opts]); },
    async copyFile(src, dest) { const ns = normalize(src), nd = normalize(dest); this._copyFileCalls.push([ns, nd]); store.set(nd, store.get(ns)); },
    async writeFile(p, c) { store.set(normalize(p), c); },
    async readFile(p) { const np = normalize(p); if (!store.has(np)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; } return store.get(np); },
    async chmod(p, m) { this._chmodCalls.push([normalize(p), m]); },
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

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

test('copyTree dryRun writes nothing', async () => {
  // Arrange
  const fs = mockFs({ '/s/f': 'new' });
  // Act
  await copyTree('/s/f', '/d/f', { fs, dryRun: true });
  // Assert
  expect(fs._dump()['/d/f']).toBeUndefined();
});

test('writeText writes and applies mode', async () => {
  // Arrange
  const fs = mockFs({});
  // Act
  await writeText('/d/out.txt', 'x', { fs, mode: '0600' });
  // Assert
  expect(fs._dump()['/d/out.txt']).toBe('x');
});

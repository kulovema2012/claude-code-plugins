import { test, expect } from 'bun:test';
import { resolveDest, validateManifest, loadManifest } from '../lib/manifest.js';

test('resolveDest expands ~ to native home path', () => {
  // Arrange
  const home = process.platform === 'win32' ? 'C:\\Users\\new_k' : '/home/u';
  // Act
  const out = resolveDest('~/.claude/settings.json', home);
  // Assert
  expect(out.startsWith(home)).toBe(true);
  expect(out).not.toContain('~');
});

test('validateManifest accepts a well-formed object', () => {
  // Arrange
  const m = { version: 1, targets: [{ src: 'a', dest: '~/a', type: 'file' }] };
  // Act
  const result = validateManifest(m);
  // Assert
  expect(result.ok).toBe(true);
});

test('validateManifest rejects bad type and missing fields', () => {
  // Arrange
  const m = { version: 1, targets: [{ src: 'a', dest: '~/a', type: 'bogus' }] };
  // Act
  const r = validateManifest(m);
  // Assert
  expect(r.ok).toBe(false);
  expect(r.errors.some(e => e.includes('type'))).toBe(true);
});

test('loadManifest throws on invalid content', async () => {
  // Arrange — version must be a number; "x" makes the manifest invalid.
  const badFs = { async readFile() { return '{"version":"x"}'; } };
  // Act + Assert
  expect(loadManifest('/m', badFs)).rejects.toThrow();
});

// --- new target fields: type 'symlinks' + optional 'scan' flag (Task 10 phase 2a) ---

test('validateManifest accepts a symlinks target with linkSource', () => {
  // Arrange — symlinks targets describe a dir of links INTO a canonical source;
  // linkSource is the home-relative canonical dir the links point to.
  const m = { version: 1, targets: [
    { src: 'home/.claude/skills.links.json', dest: '~/.claude/skills', type: 'symlinks', linkSource: '~/.agents/skills', scan: false },
  ]};
  // Act
  const r = validateManifest(m);
  // Assert
  expect(r.ok).toBe(true);
});

test('validateManifest rejects a symlinks target missing linkSource', () => {
  // Arrange — a symlinks target without linkSource can neither capture nor restore.
  const m = { version: 1, targets: [
    { src: 'home/.claude/skills.links.json', dest: '~/.claude/skills', type: 'symlinks' },
  ]};
  // Act
  const r = validateManifest(m);
  // Assert
  expect(r.ok).toBe(false);
  expect(r.errors.some(e => e.includes('linkSource'))).toBe(true);
});

test('validateManifest accepts scan:false on a dir target', () => {
  // Arrange — user-content targets opt out of the blocking sync-time scan.
  const m = { version: 1, targets: [
    { src: 'home/.claude/hooks', dest: '~/.claude/hooks', type: 'dir', scan: false },
  ]};
  // Act
  const r = validateManifest(m);
  // Assert
  expect(r.ok).toBe(true);
});

test('validateManifest rejects a non-boolean scan value', () => {
  // Arrange — scan must be true|false when present, not a string.
  const m = { version: 1, targets: [
    { src: 'a', dest: '~/a', type: 'dir', scan: 'no' },
  ]};
  // Act
  const r = validateManifest(m);
  // Assert
  expect(r.ok).toBe(false);
  expect(r.errors.some(e => e.includes('scan'))).toBe(true);
});

test('validateManifest accepts skipSymlinks:true on a dir target', () => {
  // Arrange — skipSymlinks opts a `dir` capture out of recreating top-level links;
  // their structure is captured separately by a paired `symlinks` target.
  const m = { version: 1, targets: [
    { src: 'home/.claude/skills', dest: '~/.claude/skills', type: 'dir', scan: false, skipSymlinks: true },
  ]};
  // Act
  const r = validateManifest(m);
  // Assert
  expect(r.ok).toBe(true);
});

test('validateManifest rejects a non-boolean skipSymlinks value', () => {
  // Arrange — skipSymlinks must be a boolean when present.
  const m = { version: 1, targets: [
    { src: 'a', dest: '~/a', type: 'dir', skipSymlinks: 'yes' },
  ]};
  // Act
  const r = validateManifest(m);
  // Assert
  expect(r.ok).toBe(false);
  expect(r.errors.some(e => e.includes('skipSymlinks'))).toBe(true);
});

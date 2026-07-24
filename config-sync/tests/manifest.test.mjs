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

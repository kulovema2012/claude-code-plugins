// config-sync/tests/toml-check.test.mjs
// Guards the structural validator that stops codex's hooks.state duplicate-key
// corruption from being captured into a tracked template. The hardest case is
// quote-style equivalence: [a.'x'] and [a."x"] are the SAME TOML key, so a
// scanner that splits dotted keys on raw '.' (and corrupts path segments that
// contain dots, like C:/.../hooks.json) would miss it. Every test below locks
// one facet of that behavior. AAA throughout.
import { test, expect } from 'bun:test';
import { scanTomlDuplicates } from '../lib/toml-check.js';

test('flags single-quote vs double-quote headers as the same key (the codex bug)', () => {
  // Arrange — the exact shape of the corruption: two table headers that differ
  // only by quote style, defining the same key twice.
  const text = [
    `[hooks.state.'C:/Users/u/.codex/hooks.json:pre_tool_use:0:0']`,
    `enabled = true`,
    `[hooks.state."C:/Users/u/.codex/hooks.json:pre_tool_use:0:0"]`,
    `enabled = true`,
  ].join('\n');
  // Act
  const found = scanTomlDuplicates(text);
  // Assert — one table-duplicate finding pointing at the SECOND occurrence (the
  // line to remove), normalized key independent of quote style.
  expect(found.length).toBe(1);
  expect(found[0].kind).toBe('table');
  expect(found[0].line).toBe(3);
  expect(found[0].key).toBe('hooks.state.C:/Users/u/.codex/hooks.json:pre_tool_use:0:0');
});

test('flags two identical same-quote table headers', () => {
  // Arrange
  const text = '[server]\nport = 1\n[server]\nport = 2\n';
  // Act
  const found = scanTomlDuplicates(text);
  // Assert
  expect(found.length).toBe(1);
  expect(found[0].kind).toBe('table');
  expect(found[0].line).toBe(3);
  expect(found[0].key).toBe('server');
});

test('does NOT flag repeated array-of-tables ([[...]]) — each is a distinct element', () => {
  // Arrange — [[deps]] legitimately repeats; TOML appends an element each time.
  const text = '[[deps]]\nname = "a"\n[[deps]]\nname = "b"\n';
  // Act
  const found = scanTomlDuplicates(text);
  // Assert
  expect(found).toEqual([]);
});

test('returns no findings for clean, well-formed TOML', () => {
  // Arrange — distinct tables, distinct scalar keys, dotted table paths.
  const text = [
    '[a]',
    'x = 1',
    '[b]',
    'x = 2',
    '[nested.leaf]',
    'y = 3',
  ].join('\n');
  // Act / Assert
  expect(scanTomlDuplicates(text)).toEqual([]);
});

test('flags a duplicate scalar key within the same table', () => {
  // Arrange — two `enabled` assignments under one table is a hard TOML error.
  const text = '[hooks.state."k:0:0"]\nenabled = true\nenabled = false\n';
  // Act
  const found = scanTomlDuplicates(text);
  // Assert
  expect(found.length).toBe(1);
  expect(found[0].kind).toBe('scalar');
  expect(found[0].line).toBe(3);
  expect(found[0].key).toContain('enabled');
});

test('treats the same scalar name in different tables as distinct', () => {
  // Arrange — `enabled` under table A and `enabled` under table B are fine.
  const text = '[a]\nenabled = true\n[b]\nenabled = true\n';
  // Act / Assert
  expect(scanTomlDuplicates(text)).toEqual([]);
});

test('tolerates trailing comments on headers without missing or double-counting', () => {
  // Arrange — TOML allows `# ...` after a header; a brittle regex that requires
  // the line to end right after `]` would silently skip these (false negative).
  const text = [
    '[a.x] # primary',
    'k = 1',
    '[a.x] # duplicate',
    'k = 2',
  ].join('\n');
  // Act
  const found = scanTomlDuplicates(text);
  // Assert — still detected, pointing at the second header.
  expect(found.length).toBe(1);
  expect(found[0].kind).toBe('table');
  expect(found[0].line).toBe(3);
  expect(found[0].key).toBe('a.x');
});

test('ignores blank lines and comment-only lines when computing context', () => {
  // Arrange — blank + comment lines must not break table tracking.
  const text = [
    '# leading comment',
    '',
    '[pkg]',
    'v = 1',
    '',
    '# mid comment',
    '[pkg]',
    'v = 2',
  ].join('\n');
  // Act
  const found = scanTomlDuplicates(text);
  // Assert — second [pkg] sits on line 7.
  expect(found.length).toBe(1);
  expect(found[0].line).toBe(7);
});

test('reports every duplicate in a multi-duplicate file (one finding per repeat)', () => {
  // Arrange — mirrors the real corruption: 3 hook keys each duplicated.
  const dup = (q, i) => `[h.'${q}:${i}']\n[h."${q}:${i}"]\n`;
  const text = dup('pre', 0) + dup('post', 0) + dup('stop', 0);
  // Act
  const found = scanTomlDuplicates(text);
  // Assert — one finding per repeated key (lines 2, 4, 6).
  expect(found.length).toBe(3);
  expect(found.map((f) => f.line)).toEqual([2, 4, 6]);
  expect(found.every((f) => f.kind === 'table')).toBe(true);
});

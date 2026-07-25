// Tests for the CI secret scanner. Exercises runCiScan against a real tmp
// fixture: one file target that leaks, one scan:false target that must be
// skipped, and a clean dir target to confirm the walk hits every leaf.
import { test, expect } from 'bun:test';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCiScan } from '../scripts/ci-scan.mjs';
import * as fs from 'node:fs/promises';

function setupFixture() {
  const root = mkdtempSync(join(tmpdir(), 'ciscan-'));
  // Tracked file target that leaks a JSON token field (no sk- prefix so only
  // one pattern matches — keeps the assertion count-exact).
  writeFileSync(join(root, 'settings.json'), '{ "api_key": "supersecretvalue123" }\n');
  // scan:false user content that WOULD leak — must be ignored.
  mkdirSync(join(root, 'skills', 'demo'), { recursive: true });
  writeFileSync(join(root, 'skills', 'demo', 'SKILL.md'), 'example: sk-shouldbeignored9999\n');
  // Clean dir target walked recursively.
  mkdirSync(join(root, 'hooks', 'sub'), { recursive: true });
  writeFileSync(join(root, 'hooks', 'top.js'), 'module.exports = 1;\n');
  writeFileSync(join(root, 'hooks', 'sub', 'leaf.js'), 'module.exports = 2;\n');
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({
    version: 1,
    targets: [
      { src: 'settings.json', dest: '~/.claude/settings.json', type: 'file' },
      { src: 'skills', dest: '~/.claude/skills', type: 'dir', scan: false },
      { src: 'hooks', dest: '~/.claude/hooks', type: 'dir' },
    ],
  }));
  return root;
}

test('runCiScan flags a leaky file target and skips scan:false content', async () => {
  // Arrange
  const root = setupFixture();
  // Act
  const findings = await runCiScan({
    manifestPath: join(root, 'manifest.json'),
    fs,
  });
  // Assert — exactly the settings.json hit; skills content is exempt.
  expect(findings.length).toBe(1);
  expect(findings[0].path.endsWith('settings.json')).toBe(true);
  expect(findings[0].kind).toBe('token_field');
  expect(findings[0].redacted).not.toContain('supersecret'); // redacted, value never surfaces
});

test('runCiScan returns no findings when the scanned set is clean', async () => {
  // Arrange — same fixture but the leaky file is replaced with clean content.
  const root = setupFixture();
  writeFileSync(join(root, 'settings.json'), '{ "model": "fable" }\n');
  // Act
  const findings = await runCiScan({
    manifestPath: join(root, 'manifest.json'),
    fs,
  });
  // Assert — no findings; the hooks dir walk ran (no exceptions) and found nothing.
  expect(findings).toEqual([]);
});

test('runCiScan flags duplicate keys in a tracked .toml target (the merge gate)', async () => {
  // Arrange — a tracked config.toml carrying codex's duplicate [hooks.state]
  // headers (single-quote vs double-quote = same TOML key), twice over. This is
  // the belt-and-suspenders gate: even if a broken template slipped past capture,
  // CI must surface it so it can't merge.
  const root = mkdtempSync(join(tmpdir(), 'ciscan-toml-'));
  const dup = (q) =>
    `[hooks.state.'C:/u/.codex/hooks.json:${q}']\nenabled = true\n` +
    `[hooks.state."C:/u/.codex/hooks.json:${q}"]\nenabled = true\n`;
  writeFileSync(join(root, 'config.toml'), `model = "x"\n` + dup('pre_tool_use:0:0') + dup('stop:0:0'));
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({
    version: 1,
    targets: [
      { src: 'config.toml', dest: '~/.codex/config.toml', type: 'template' },
    ],
  }));
  // Act
  const findings = await runCiScan({ manifestPath: join(root, 'manifest.json'), fs });
  // Assert — two table-duplicate findings (one per repeated key), tagged dup_table
  // so they're distinct from secret kinds, each with a line number and normalized key.
  const tomFinds = findings.filter((f) => f.kind === 'dup_table');
  expect(tomFinds.length).toBe(2);
  expect(tomFinds.every((f) => typeof f.line === 'number')).toBe(true);
  expect(tomFinds.every((f) => f.key && f.key.startsWith('hooks.state.'))).toBe(true);
  // No secret false positives on the TOML content.
  expect(findings.some((f) => f.redacted !== undefined)).toBe(false);
});

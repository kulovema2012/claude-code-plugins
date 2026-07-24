// config-sync/lib/sync.js
// Reverse-capture core: reads LIVE config files from $HOME, regenerates portable
// templates ({{HOME}}, {{TOKEN}}), and writes them back into the repo. The guard
// refuses to write any file containing a residual secret unless --refresh-secrets
// is set. runSync is the testable core — all I/O deps (fs, log) are injectable;
// sync.mjs is the thin CLI shim that wires real process state.
//
// SAFETY (controller-mandated): EVERY target type is scanned at its SOURCE
// before any disk write, so a detectable secret can never reach a tracked file:
//   template -> render to an in-memory string, scan that string, write only if clean.
//   file/dir -> walk the live source tree (scanTreeLeak), scan each leaf, copy
//               only if every leaf is clean.
// In both cases a residual secret (with !refreshSecrets) is collected into
// `leaked` and the write/copy is skipped, so the secret-bearing bytes never land
// on disk — no risk of an accidental `git add`. refreshSecrets is the documented
// escape hatch (write through and report).

import path from 'node:path';
import { resolveDest } from './manifest.js';
import { copyTree, writeText } from './fs-util.js';
import { scanSecrets } from './secrets.js';

// Per-dest redaction rules. Keys are manifest `dest` values. Applied BEFORE home
// normalization. Only well-known high-signal patterns are mapped here; anything
// else is left for the scanSecrets guard to catch.
export const TEMPLATE_RULES = {
  '~/.codex/config.toml': [
    { match: /sk-[A-Za-z0-9_-]{8,}/g, token: 'CODEX_API_KEY' },
    { match: /Bearer\s+[A-Za-z0-9._-]{6,}/g, token: 'CODEX_BEARER' },
  ],
  '~/.claude/settings.json': [
    { match: /sk-[A-Za-z0-9_-]{8,}/g, token: 'CLAUDE_API_KEY' },
  ],
};

// Redact known secrets -> {{TOKEN}}, then normalize the live home path (native
// AND forward-slash form) -> {{HOME}}, flipping adjacent backslashes to forward
// slashes so the rendered template stays cross-platform.
export function regenerateTemplate(liveText, dest, home) {
  let out = liveText;
  for (const { match, token } of (TEMPLATE_RULES[dest] || [])) {
    out = out.replace(match, `{{${token}}}`); // global regex -> replaces all occurrences
  }
  if (home) {
    const variants = new Set([home, home.replace(/\\/g, '/')]);
    for (const v of variants) out = out.split(v).join('{{HOME}}'); // literal, no regex escaping
    // Flip backslashes in the path remainder that follows {{HOME}} -> forward slash.
    out = out.replace(/({{HOME}})(\\[^\s"',}\]]*)/g, (_full, h, rest) => h + rest.replace(/\\/g, '/'));
  }
  return out;
}

// Walk a live source tree (mirroring copyTree's traversal) and return scanSecrets
// findings per leaf file. Used to pre-scan file/dir targets BEFORE any disk write
// so a leaking source is never copied into the repo.
async function scanTreeLeak(srcAbs, fs) {
  const results = [];
  let stat;
  try { stat = await fs.lstat(srcAbs); }
  catch (e) { if (e.code === 'ENOENT') return results; throw e; }
  if (stat.isDirectory()) {
    let entries;
    try { entries = await fs.readdir(srcAbs); }
    catch (e) { if (e.code === 'ENOENT') return results; throw e; }
    for (const entry of entries) {
      const sub = await scanTreeLeak(path.resolve(srcAbs, entry), fs);
      results.push(...sub);
    }
    return results;
  }
  let txt;
  try { txt = await fs.readFile(srcAbs, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return results; throw e; }
  const found = scanSecrets(txt);
  if (found.length) results.push({ path: srcAbs, found });
  return results;
}

// Reverse-capture entry point. For each manifest target:
//   file/dir   -> walk live source (scanTreeLeak), copy into repo only if clean.
//   template   -> read live dest, regenerate, IN-MEMORY pre-scan, write if clean.
// Returns { actions, leaked }. Throws if any residual secret is detected and
// refreshSecrets is not set.
export async function runSync({ manifest, home, repoRoot, fs, log, refreshSecrets, dryRun }) {
  const f = fs || (await import('node:fs/promises'));
  const out = log || (() => {});
  const actions = [];
  const leaked = [];

  for (const t of manifest.targets) {
    const liveAbs = resolveDest(t.dest, home);
    const repoAbs = path.resolve(repoRoot, t.src);

    if (t.type === 'file' || t.type === 'dir') {
      // SAFETY: walk the live source and scan every leaf BEFORE any disk write.
      const srcLeaks = await scanTreeLeak(liveAbs, f);
      if (srcLeaks.length && !refreshSecrets) {
        for (const s of srcLeaks) leaked.push({ path: s.path, found: s.found });
        out('skip-leak', liveAbs);
        continue; // DO NOT copy — secret never reaches a tracked file
      }
      const sub = await copyTree(liveAbs, repoAbs, { force: true, dryRun, fs: f, log: out });
      actions.push(...sub);
      if (srcLeaks.length) {
        // refreshSecrets: copy through, but surface the leaks for review.
        for (const s of srcLeaks) leaked.push({ path: s.path, found: s.found });
      }
      continue;
    }

    if (t.type === 'template') {
      let liveText;
      try { liveText = await f.readFile(liveAbs, 'utf8'); }
      catch (e) { if (e.code === 'ENOENT') { out('skip-missing', liveAbs); continue; } throw e; }

      const rendered = regenerateTemplate(liveText, t.dest, home);

      // SAFETY: scan the rendered string IN MEMORY before any disk write.
      const found = scanSecrets(rendered);
      if (found.length && !refreshSecrets) {
        leaked.push({ path: repoAbs, found });
        out('skip-leak', repoAbs);
        continue; // DO NOT write — secret never reaches a tracked file
      }

      await writeText(repoAbs, rendered, { force: true, dryRun, fs: f, log: out });
      actions.push({ action: 'template', dest: repoAbs });
      if (found.length) leaked.push({ path: repoAbs, found }); // refreshSecrets: written + reported
    }
  }

  if (leaked.length && !refreshSecrets) {
    const detail = leaked.map(l => `${l.path}: ${l.found.map(x => x.kind).join(',')}`).join('\n');
    throw new Error(`Refusing to sync — residual secret(s) detected. Review TEMPLATE_RULES or re-run with --refresh-secrets only if intentional:\n${detail}`);
  }
  return { actions, leaked };
}

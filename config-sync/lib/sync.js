// config-sync/lib/sync.js
// Reverse-capture core: reads LIVE config files from $HOME, regenerates portable
// templates ({{HOME}}, {{TOKEN}}), and writes them back into the repo. The guard
// refuses to write any file containing a residual secret unless --refresh-secrets
// is set. runSync is the testable core — all I/O deps (fs, log) are injectable;
// sync.mjs is the thin CLI shim that wires real process state.
//
// SAFETY (controller-mandated): template targets are rendered to an IN-MEMORY
// string and scanned for secrets BEFORE any disk write. A leaking template is
// never written, so its secret cannot reach a tracked file (no risk of an
// accidental `git add`). file/dir targets cannot be pre-rendered (a directory
// copy is opaque), so they are post-write scanned instead; the guard still
// aborts on residual secrets so a leak is never left silently — but for file/dir
// the bytes do touch disk first, which is the accepted tradeoff of that path.

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

// Reverse-capture entry point. For each manifest target:
//   file/dir   -> copy live dest into repo src (post-write scan).
//   template   -> read live dest, regenerate, IN-MEMORY pre-scan, write if clean.
// Returns { actions, leaked }. Throws if any residual secret is detected and
// refreshSecrets is not set.
export async function runSync({ manifest, home, repoRoot, fs, log, refreshSecrets, dryRun }) {
  const f = fs || (await import('node:fs/promises'));
  const out = log || (() => {});
  const actions = [];
  const leaked = [];
  const written = []; // file/dir repo paths queued for post-write scan

  for (const t of manifest.targets) {
    const liveAbs = resolveDest(t.dest, home);
    const repoAbs = path.resolve(repoRoot, t.src);

    if (t.type === 'file' || t.type === 'dir') {
      // Reverse copy live -> repo. Post-write scan below catches residual secrets.
      const sub = await copyTree(liveAbs, repoAbs, { force: true, dryRun, fs: f, log: out });
      actions.push(...sub);
      if (!dryRun) for (const a of sub) if (a.action === 'write') written.push(a.dest);
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
      // NOTE: intentionally NOT added to `written` — template was pre-scanned;
      // post-scanning it again would double-count the leak under refreshSecrets.
    }
  }

  // Post-write guard: scan every file/dir leaf we copied into the repo.
  for (const p of written) {
    let txt;
    try { txt = await f.readFile(p, 'utf8'); } catch { continue; }
    const found = scanSecrets(txt);
    if (found.length) leaked.push({ path: p, found });
  }

  if (leaked.length && !refreshSecrets) {
    const detail = leaked.map(l => `${l.path}: ${l.found.map(x => x.kind).join(',')}`).join('\n');
    throw new Error(`Refusing to sync — residual secret(s) detected. Review TEMPLATE_RULES or re-run with --refresh-secrets only if intentional:\n${detail}`);
  }
  return { actions, leaked };
}

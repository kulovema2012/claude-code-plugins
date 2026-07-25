// config-sync/scripts/ci-scan.mjs
// Manifest-aware config scanner for CI. Loads manifest.json, resolves each
// target's repo `src` (dir -> recursive walk; file/template/symlinks -> single
// file), runs scanSecrets over each AND scanTomlDuplicates over each .toml,
// prints `path:line [kind] redacted|key` for every hit, and exits 1 on any hit.
// Targets with scan:false (user content: skills/memories/hooks) are SKIPPED —
// they would drown CI in doc-example false positives. The blocking scan happens
// at sync time (lib/sync.js) against the LIVE source; this is the
// belt-and-suspenders check against tracked files.
//
// Invoked from the repo root as: `bun config-sync/scripts/ci-scan.mjs`.
// Self-locating via import.meta.url so cwd is irrelevant.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadManifest } from '../lib/manifest.js';
import { scanSecrets } from '../lib/secrets.js';
import { scanTomlDuplicates } from '../lib/toml-check.js';

// Resolve the on-disk files a manifest target contributes to the scan. `dir`
// walks recursively; every other type maps to a single file (templates are
// stored as one .tmpl; symlinks targets are one sidecar JSON).
async function resolveSourceFiles(srcAbs, type, f) {
  if (type === 'dir') return walkDir(srcAbs, f);
  return [srcAbs];
}

async function walkDir(dir, f) {
  const out = [];
  let stat;
  try { stat = await f.lstat(dir); }
  catch (e) { if (e.code === 'ENOENT') return out; throw e; }
  if (!stat.isDirectory()) return out;
  let entries;
  try { entries = await f.readdir(dir); }
  catch (e) { if (e.code === 'ENOENT') return out; throw e; }
  for (const entry of entries) {
    const sub = path.resolve(dir, entry);
    let subStat;
    try { subStat = await f.lstat(sub); }
    catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    if (subStat.isDirectory()) out.push(...await walkDir(sub, f));
    else out.push(sub);
  }
  return out;
}

// Testable core. manifestPath is absolute; manifest `src` paths resolve
// relative to its directory. Returns an array of { path, line, kind, redacted }.
export async function runCiScan({ manifestPath, fs, log }) {
  const f = fs || (await import('node:fs/promises'));
  const out = log || (() => {});
  const manifestRoot = path.dirname(manifestPath);
  const manifest = await loadManifest(manifestPath, f);
  const findings = [];

  for (const t of manifest.targets) {
    if (t.scan === false) continue; // user content — exempt
    const srcAbs = path.resolve(manifestRoot, t.src);
    const files = await resolveSourceFiles(srcAbs, t.type, f);
    for (const file of files) {
      let txt;
      try { txt = await f.readFile(file, 'utf8'); }
      catch (e) { if (e.code === 'ENOENT') { out('skip-missing', file); continue; } throw e; }
      for (const h of scanSecrets(txt)) {
        findings.push({ path: file, line: h.line, kind: h.kind, redacted: h.redacted });
      }
      // Structural check: duplicate keys in a tracked .toml (e.g. codex's
      // [hooks.state] corruption) break the consumer on load. Tagged
      // dup_table/dup_scalar so findings are distinct from secret kinds.
      if (file.endsWith('.toml')) {
        for (const d of scanTomlDuplicates(txt)) {
          findings.push({ path: file, line: d.line, kind: `dup_${d.kind}`, key: d.key });
        }
      }
    }
  }
  return findings;
}

// CLI entry point. Reports paths relative to the repo root (parent of
// config-sync) with forward slashes for stable CI output across platforms.
export async function main() {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const CONFIG_SYNC_ROOT = path.resolve(HERE, '..');
  const repoRoot = path.resolve(CONFIG_SYNC_ROOT, '..');
  const manifestPath = path.join(CONFIG_SYNC_ROOT, 'manifest.json');

  const findings = await runCiScan({ manifestPath });
  let bad = 0;
  for (const fnd of findings) {
    const rel = path.relative(repoRoot, fnd.path).replace(/\\/g, '/');
    console.log(`${rel}:${fnd.line} [${fnd.kind}] ${fnd.redacted ?? fnd.key}`);
    bad++;
  }
  if (bad) {
    console.error(`\nConfig scan FAILED: ${bad} finding(s) in scanned manifest targets (secrets or duplicate TOML keys).`);
    process.exit(1);
  }
  console.log('Config scan OK: 0 findings across scanned manifest targets.');
  process.exit(0);
}

// Run only when invoked directly (not on test import).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

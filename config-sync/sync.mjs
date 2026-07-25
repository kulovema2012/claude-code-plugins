// config-sync/sync.mjs
// Thin CLI wrapper around runSync. Captures live config from $HOME into repo
// templates/, regenerating {{HOME}}/{{TOKEN}} placeholders. Aborts (exit 1) if a
// residual secret would land in a tracked file unless --refresh-secrets is set.
// Flags: --dry-run (preview actions, write nothing), --refresh-secrets (write
// through and report residual secrets instead of aborting).

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadManifest } from './lib/manifest.js';
import { runSync } from './lib/sync.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function main() {
  const argv = process.argv.slice(2);
  const fsp = await import('node:fs/promises');
  const manifest = await loadManifest(path.join(HERE, 'manifest.json'), fsp);
  try {
    const { actions, leaked, structIssues } = await runSync({
      manifest,
      home: os.homedir(),
      repoRoot: HERE,
      fs: fsp,
      log: (kind, p) => console.log(`  ${kind}  ${p}`),
      refreshSecrets: argv.includes('--refresh-secrets'),
      dryRun: argv.includes('--dry-run'),
    });
    console.log(`\nSynced ${actions.length} entr${actions.length === 1 ? 'y' : 'ies'}.`);
    if (structIssues.length) {
      console.log(`Warning: ${structIssues.length} TOML file(s) skipped due to duplicate keys (tracked template left unchanged):`);
      for (const s of structIssues) {
        for (const fnd of s.findings) console.log(`  ${s.dest}:${fnd.line} [${fnd.kind}] ${fnd.key}`);
      }
      console.log('Fix the live file (remove the duplicate keys) and re-run sync.');
    }
    if (leaked.length) console.log(`Note: ${leaked.length} file(s) contained residual secrets (--refresh-secrets used).`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

// Run only when invoked directly — never when imported. pathToFileURL normalizes
// Windows backslash/spacing so the comparison is portable across node and bun.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}

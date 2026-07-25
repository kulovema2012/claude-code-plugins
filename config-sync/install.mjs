// Cross-platform restore CLI. Reads manifest.json + .env.local, renders
// {{TOKEN}} templates (HOME pre-forward-slashed per spec §6), and copies/
// symlinks files into the user's home dir. runInstall is the testable core:
// all I/O deps (fs, stdout, cwd, home, envFile) are injectable. main() is a
// thin shim that wires real process state for direct CLI invocation.
//
// NOTE: render.js's opts.allowMissing is vestigial — renderTemplate ALWAYS
// populates `missing` and leaves unknown {{TOKEN}} literals in `rendered`.
// So --allow-missing is enforced HERE by branching on the returned missing
// array, not by render's flag. We still pass allowMissing into renderTemplate
// (harmless, future-proofs against a future render.js change).

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadManifest, resolveDest } from './lib/manifest.js';
import { loadEnvFile } from './lib/env.js';
import { renderTemplate } from './lib/render.js';
import { copyTree, writeText } from './lib/fs-util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function runInstall({ argv, cwd, home, envFile, fs, stdout }) {
  const f = fs || (await import('node:fs/promises'));
  const out = stdout || ((s) => console.log(s));
  const opts = {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    symlink: argv.includes('--symlink'),
    allowMissing: argv.includes('--allow-missing'),
    fs: f,
    log: (kind, p) => out(`  ${kind}  ${p}`),
  };

  const manifest = await loadManifest(path.join(cwd, 'manifest.json'), f);
  const env = await loadEnvFile(envFile || path.join(HERE, '.env.local'), f);
  // Forward-slash HOME so rendered JSON/content stays cross-platform; dest
  // PATHS resolve native via resolveDest (distinct concern).
  const placeholders = { ...env, HOME: home.split(/[\\/]/).join('/') };

  const allMissing = [];
  for (const t of manifest.targets) {
    const dest = resolveDest(t.dest, home);
    if (t.type === 'file' || t.type === 'dir') {
      const srcAbs = path.resolve(cwd, t.src);
      if (opts.symlink && process.platform !== 'win32' && !opts.dryRun) {
        await f.mkdir(path.dirname(dest), { recursive: true });
        try { await f.unlink(dest); } catch {}
        await f.symlink(srcAbs, dest);
        out(`  link  ${dest}`);
      } else {
        await copyTree(srcAbs, dest, opts);
      }
    } else if (t.type === 'symlinks') {
      // Recreate a directory of symlinks captured as a sidecar JSON. Each entry
      // maps a link name to a home-relative target; resolve target against home
      // and symlink it under dest. Skip existing links unless --force.
      const sidecar = JSON.parse(await f.readFile(path.resolve(cwd, t.src), 'utf8'));
      await f.mkdir(dest, { recursive: true });
      for (const [linkName, relTarget] of Object.entries(sidecar)) {
        const linkDest = path.join(dest, linkName);
        const target = path.join(home, relTarget);
        let exists = false; try { await f.lstat(linkDest); exists = true; } catch {}
        if (exists && !opts.force) { opts.log('skip', linkDest); continue; }
        if (opts.dryRun) { opts.log('link', linkDest); continue; }
        if (exists) { try { await f.unlink(linkDest); } catch {} }
        await f.symlink(target, linkDest);
        opts.log('link', linkDest);
      }
    } else if (t.type === 'template') {
      const tmpl = await f.readFile(path.resolve(cwd, t.src), 'utf8');
      const { rendered, missing } = renderTemplate(tmpl, placeholders, { allowMissing: opts.allowMissing });
      allMissing.push(...missing);
      await writeText(dest, rendered, { mode: t.mode, dryRun: opts.dryRun, fs: f, log: opts.log });
    }
  }

  // Gate on collected missing — render's allowMissing flag does NOT change
  // rendering, so this branch is the source of truth for the exit-2 contract.
  if (allMissing.length && !opts.allowMissing) {
    out(`\nMissing placeholders: ${[...new Set(allMissing)].join(', ')}`);
    out('Fill them in .env.local, or re-run with --allow-missing.');
    return 2;
  }
  out('\nRestore complete. Remember to re-authenticate (Claude /login, codex login).');
  return 0;
}

export async function main() {
  const code = await runInstall({
    argv: process.argv.slice(2),
    cwd: HERE,
    home: os.homedir(),
    fs: await import('node:fs/promises'),
    stdout: (s) => console.log(s),
  });
  process.exit(code);
}

// Run only when invoked directly as the entry script — never when imported
// (e.g. by the test file). pathToFileURL normalizes Windows backslash/spacing
// so the comparison is portable across node and bun.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}

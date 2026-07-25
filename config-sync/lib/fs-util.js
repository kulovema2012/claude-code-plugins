import { resolve, dirname } from 'node:path';

async function defaultFs() { return (await import('node:fs/promises')); }
async function exists(p, fs) { try { await fs.lstat(p); return true; } catch { return false; } }

export async function copyTree(srcAbs, destAbs, opts = {}) {
  const fs = opts.fs || await defaultFs();
  const log = opts.log || (() => {});
  const actions = [];
  const stat = await fs.lstat(srcAbs);
  // Symlink leaf: recreate the link at dest (readlink + symlink). NEVER readFile
  // a symlink — if it points at a directory, readFile throws EISDIR (the bug
  // that halted capture of ~/.claude/skills, a farm of links into ~/.agents).
  // fs.symlink does not overwrite, so under force we unlink a stale dest first.
  if (stat.isSymbolicLink && stat.isSymbolicLink()) {
    // skipSymlinks: drop the entry entirely — its link structure is captured
    // separately by a paired `symlinks` target (hybrid mixed-dir capture).
    if (opts.skipSymlinks) return actions;
    const target = await fs.readlink(srcAbs);
    const destExists = await exists(destAbs, fs);
    if (destExists && !opts.force) {
      log('skip', destAbs);
      actions.push({ action: 'skip', dest: destAbs });
      return actions;
    }
    if (opts.dryRun) { log('link', destAbs); actions.push({ action: 'link', dest: destAbs }); return actions; }
    await fs.mkdir(dirname(destAbs), { recursive: true });
    if (destExists) { try { await fs.unlink(destAbs); } catch {} }
    await fs.symlink(target, destAbs);
    log('link', destAbs);
    actions.push({ action: 'link', dest: destAbs });
    return actions;
  }
  if (stat.isDirectory()) {
    if (!opts.dryRun) await fs.mkdir(destAbs, { recursive: true });
    for (const entry of await fs.readdir(srcAbs)) {
      const sub = await copyTree(resolve(srcAbs, entry), resolve(destAbs, entry), opts);
      actions.push(...sub);
    }
    return actions;
  }
  const destExists = await exists(destAbs, fs);
  if (destExists && !opts.force) {
    log('skip', destAbs);
    actions.push({ action: 'skip', dest: destAbs });
    return actions;
  }
  if (opts.dryRun) { log('write', destAbs); actions.push({ action: 'write', dest: destAbs }); return actions; }
  await fs.mkdir(dirname(destAbs), { recursive: true });
  await fs.copyFile(srcAbs, destAbs);
  log('write', destAbs);
  actions.push({ action: 'write', dest: destAbs });
  return actions;
}

export async function writeText(path, content, opts = {}) {
  const fs = opts.fs || await defaultFs();
  const log = opts.log || (() => {});
  if (opts.dryRun) { log('write', path); return { action: 'write', dest: path }; }
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content, 'utf8');
  if (opts.mode) await fs.chmod(path, parseInt(opts.mode, 8));
  log('write', path);
  return { action: 'write', dest: path };
}

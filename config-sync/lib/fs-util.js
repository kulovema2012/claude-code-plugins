import { resolve, dirname, isAbsolute } from 'node:path';

async function defaultFs() { return (await import('node:fs/promises')); }
async function exists(p, fs) { try { await fs.lstat(p); return true; } catch { return false; } }

// Windows-only: fs.symlink defaults the link `type` to 'file', which mis-types a
// directory link as a broken file link when the target is absent at create time.
// Resolve the link target and stat it so we pass 'dir'/'file' explicitly. POSIX
// ignores `type`, so we return undefined there. `platform` defaults to
// process.platform (passing opts.platform=undefined still triggers the default).
// Best-effort: if the target can't be stat'd (e.g. not yet restored), fall back
// to 'file' — restored later by the manifest-order guarantee (agents/skills first).
export async function linkType(fs, target, platform = process.platform) {
  if (platform !== 'win32') return undefined;
  try { return (await fs.stat(target)).isDirectory() ? 'dir' : 'file'; }
  catch { return 'file'; }
}

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
    // Resolve relative link targets against the source's dir so stat works, then
    // pass the Windows link type (dir/file) — see linkType.
    const resolvedTarget = isAbsolute(target) ? target : resolve(dirname(srcAbs), target);
    await fs.symlink(target, destAbs, await linkType(fs, resolvedTarget, opts.platform));
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

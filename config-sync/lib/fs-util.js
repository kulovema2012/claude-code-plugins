import { resolve, dirname } from 'node:path';

async function defaultFs() { return (await import('node:fs/promises')); }
async function exists(p, fs) { try { await fs.lstat(p); return true; } catch { return false; } }

export async function copyTree(srcAbs, destAbs, opts = {}) {
  const fs = opts.fs || await defaultFs();
  const log = opts.log || (() => {});
  const actions = [];
  const stat = await fs.lstat(srcAbs);
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

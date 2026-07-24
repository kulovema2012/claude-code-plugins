// Loads + validates manifest.json, and resolves ~-prefixed destination paths
// to a native home path (so filesystem writes land correctly per-OS). This is
// distinct from {{HOME}} substitution inside file *content*, which is the
// renderer's job. loadManifest takes an injectable fs so tests avoid real disk.

import { resolve as resolvePath } from 'node:path';

export function resolveDest(dest, home) {
  if (dest === '~') return home;
  if (dest.startsWith('~/') || dest.startsWith('~\\')) return resolvePath(home, dest.slice(2));
  return dest;
}

export function validateManifest(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['manifest: not an object'] };
  if (typeof obj.version !== 'number') errors.push('manifest.version must be a number');
  if (!Array.isArray(obj.targets)) return { ok: false, errors: ['manifest.targets must be an array'] };
  obj.targets.forEach((t, i) => {
    if (!t || typeof t !== 'object') return errors.push(`target[${i}]: not an object`);
    if (typeof t.src !== 'string' || !t.src) errors.push(`target[${i}].src required`);
    if (typeof t.dest !== 'string' || !t.dest) errors.push(`target[${i}].dest required`);
    if (!['file', 'dir', 'template'].includes(t.type)) errors.push(`target[${i}].type must be file|dir|template`);
  });
  return { ok: errors.length === 0, errors };
}

export async function loadManifest(path, fs) {
  const f = fs || (await import('node:fs/promises'));
  const obj = JSON.parse(await f.readFile(path, 'utf8'));
  const v = validateManifest(obj);
  if (!v.ok) throw new Error('Invalid manifest:\n' + v.errors.join('\n'));
  return obj;
}

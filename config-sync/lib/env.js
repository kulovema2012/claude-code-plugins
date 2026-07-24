// Parses .env.local KEY=VALUE lines: skips # comments and blanks, strips one
// layer of surrounding matched quotes. loadEnvFile takes an injectable fs so
// tests never touch real disk; a missing file (ENOENT) returns {} — first run
// with no .env.local is a normal, non-error state.

export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

export async function loadEnvFile(path, fs) {
  const f = fs || (await import('node:fs/promises'));
  try {
    const text = await f.readFile(path, 'utf8');
    return parseEnv(text);
  } catch (e) {
    if (e && e.code === 'ENOENT') return {};
    throw e;
  }
}

// config-sync/lib/toml-check.js
// Structural validator for tracked TOML config (~/.codex/config.toml). Detects
// the duplicate keys a strict TOML parser would reject — the exact failure codex
// produced when it wrote [hooks.state] entries twice with different quote styles.
// Wired into lib/sync.js (capture guard) and scripts/ci-scan.mjs (CI gate) so a
// structurally broken config can never be captured into the tracked template
// store and re-installed on another machine.
//
// WHY A CUSTOM TOKENIZER (not split('.')): a dotted-key segment may be a QUOTED
// string that itself contains dots — e.g. 'C:/Users/u/.codex/hooks.json:pre:0:0'.
// Splitting on raw '.' shatters that segment and makes single-quote vs
// double-quote spellings of the SAME key look different, producing a false
// negative that defeats the entire check. We tokenize respecting quotes,
// exactly as TOML does: [a.'x.y'] and [a."x.y"] both normalize to a.x.y.

const HEADER_RE = /^\s*\[([^\[\]]+)\]\s*(?:#.*)?$/;     // [table.path]   (+ optional trailing comment)
const ARRAY_RE  = /^\s*\[\[([^\[\]]+)\]\]\s*(?:#.*)?$/; // [[array.of.tables]]
const SCALAR_RE = /^\s*([A-Za-z0-9_-]+)\s*=/;           // bare_key = value

// Map TOML basic-string escape sequences to their characters. Unknown escapes
// fall back to the literal char after the backslash — sufficient for key
// equality (both quote styles of the same key normalize identically).
const BASIC_ESCAPES = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', b: '\b', f: '\f' };

// Tokenize a TOML dotted key into normalized segments, respecting quoted
// segments: single-quoted = literal (no escapes), double-quoted = basic
// (escapes processed). Whitespace around dots is allowed, mirroring TOML.
function normalizePath(raw) {
  const segs = [];
  let i = 0;
  const n = raw.length;
  while (i < n) {
    while (i < n && (raw[i] === '.' || /\s/.test(raw[i]))) i++;
    if (i >= n) break;
    const ch = raw[i];
    if (ch === "'") { // literal string — ends at the next ', no escapes
      i++;
      const start = i;
      while (i < n && raw[i] !== "'") i++;
      segs.push(raw.slice(start, i));
      i++; // consume closing quote
    } else if (ch === '"') { // basic string — process backslash escapes
      i++;
      let buf = '';
      while (i < n && raw[i] !== '"') {
        if (raw[i] === '\\' && i + 1 < n) {
          buf += BASIC_ESCAPES[raw[i + 1]] ?? raw[i + 1];
          i += 2;
        } else {
          buf += raw[i];
          i++;
        }
      }
      segs.push(buf);
      i++; // consume closing quote
    } else { // bare key — A-Za-z0-9_-, stops at '.' or whitespace
      const start = i;
      while (i < n && raw[i] !== '.' && !/\s/.test(raw[i])) i++;
      segs.push(raw.slice(start, i));
    }
  }
  return segs.join('.');
}

// Scan TOML text for duplicate keys. Returns one finding per occurrence AFTER
// the first: { line, kind: 'table'|'scalar', key }. `line` points at the line to
// remove; `key` is the normalized dotted path (tables) or "path > name" (scalars).
//
// Scope rules:
//   [t]        — a table; repeats are duplicates.
//   [[t]]      — an array-of-tables element; each occurrence is a DISTINCT
//                scope (repeats are legal), so its scalars never collide across
//                elements and it is never itself flagged as a duplicate.
//
// De-duplication: when a table is itself a duplicate, its scalars are duplicates
// only as a CONSEQUENCE — reporting them too would turn one real problem into
// three (table + each repeated scalar). So a scalar-dup finding is suppressed
// when its table was already flagged; a genuine same-table scalar dup
// (`[a]\nx=1\nx=2`, no table dup) is still reported.
//
// Known limitation: dotted scalar assignments (a.b = 1) and quoted scalar keys
// are not tracked — config.toml's hooks.state uses table headers, not these.
export function scanTomlDuplicates(text) {
  const lines = text.split(/\r?\n/);
  const tables = new Map();          // normalized path -> first line seen
  const scalars = new Map();         // `${scope}::${name}` -> first line seen
  const arrayCount = new Map();      // normalized array path -> element index
  const dupTableScopes = new Set();  // table paths already flagged as duplicates
  const findings = [];
  let scope = '';                    // current scalar scope (table path, or `${path}#${i}`)

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const lineNo = idx + 1;

    const arr = line.match(ARRAY_RE);
    if (arr) {
      const path = normalizePath(arr[1]);
      const count = arrayCount.get(path) ?? 0;
      arrayCount.set(path, count + 1);
      scope = `${path}#${count}`; // each [[...]] element gets its own scalar scope
      continue;
    }

    const hdr = line.match(HEADER_RE);
    if (hdr) {
      const path = normalizePath(hdr[1]);
      scope = path;
      if (tables.has(path)) {
        dupTableScopes.add(path);
        findings.push({ line: lineNo, kind: 'table', key: path });
      } else {
        tables.set(path, lineNo);
      }
      continue;
    }

    const kv = line.match(SCALAR_RE);
    if (kv) {
      const full = `${scope}::${kv[1]}`;
      if (scalars.has(full)) {
        // Suppress the scalar dup if its table was already flagged — it's a
        // consequence of the table duplicate, not a separate problem.
        if (!dupTableScopes.has(scope)) {
          findings.push({ line: lineNo, kind: 'scalar', key: `${scope} > ${kv[1]}` });
        }
      } else {
        scalars.set(full, lineNo);
      }
    }
  }

  return findings;
}

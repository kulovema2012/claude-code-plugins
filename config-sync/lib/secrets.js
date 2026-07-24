// config-sync/lib/secrets.js
// Detects likely secrets without capturing full values (output is redacted).
// Used by lib/sync.js (template-regeneration guard) and CI (.github/workflows/secret-scan.yml).

export const SECRET_PATTERNS = [
  { kind: 'api_key_sk',  re: /sk-[A-Za-z0-9_-]{8,}/g },
  { kind: 'bearer',      re: /Bearer\s+[A-Za-z0-9._-]{6,}/g },
  { kind: 'token_field', re: /("(?:token|access_token|refresh_token|id_token|api[_-]?key|secret|client[_-]?secret|password|apikey|oauthToken)"\s*:\s*")[^"]{3,}/gi },
  { kind: 'private_key', re: /BEGIN (?:RSA|EC|OPENSSH|PGP) PRIVATE KEY/g },
  { kind: 'url_cred',    re: /https?:\/\/[^/\s:@]+:[^/\s:@]+@/g },
];

export function scanSecrets(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const { kind, re } of SECRET_PATTERNS) {
      const pattern = new RegExp(re.source, re.flags);
      let m;
      while ((m = pattern.exec(lines[i])) !== null) {
        findings.push({ line: i + 1, kind, redacted: m[0].slice(0, 3) + '…' });
      }
    }
  }
  return findings;
}

export function hasSecret(text) {
  return scanSecrets(text).length > 0;
}

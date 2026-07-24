// config-sync/tests/secrets.test.mjs
import { test, expect } from 'bun:test';
import { scanSecrets, hasSecret } from '../lib/secrets.js';

test('detects an sk- API key', () => {
  // Arrange
  const text = 'const key = "sk-abcd1234567890efgh";';
  // Act
  const found = scanSecrets(text);
  // Assert
  expect(found.length).toBe(1);
  expect(found[0].kind).toBe('api_key_sk');
  expect(found[0].line).toBe(1);
  expect(found[0].redacted.startsWith('sk-')).toBe(true);
});

test('detects a Bearer token', () => {
  const found = scanSecrets('Authorization: Bearer abcdef123456');
  expect(found[0].kind).toBe('bearer');
});

test('detects a JSON token field', () => {
  const found = scanSecrets('{ "api_key": "supersecretvalue123" }');
  expect(found[0].kind).toBe('token_field');
});

test('returns empty for clean text', () => {
  expect(scanSecrets('just normal config = true')).toEqual([]);
  expect(hasSecret('just normal config = true')).toBe(false);
});

test('detects a URL with embedded credentials and terminates', () => {
  // Arrange — DB URL containing user:password (the exact input this scanner exists to catch).
  // Guards the Critical fix: a non-global url_cred regex would loop forever in while/exec.
  // Reaching the assertions below IS the termination proof — JS is single-threaded, so a
  // regressed regex would hang this test rather than fail it cleanly.
  const text = 'db = https://user:pass@host.example/db';
  // Act
  const found = scanSecrets(text);
  // Assert — exactly one url_cred finding on line 1, no secret material in redacted form
  expect(found.length).toBe(1);
  expect(found[0].kind).toBe('url_cred');
  expect(found[0].line).toBe(1);
  expect(found[0].redacted).not.toContain('user');
  expect(found[0].redacted).not.toContain('pass');
});

test('detects a PEM private key header', () => {
  // Arrange — text containing a private key marker line
  const text = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...';
  // Act
  const found = scanSecrets(text);
  // Assert — flagged as private_key on line 1
  expect(found.length).toBe(1);
  expect(found[0].kind).toBe('private_key');
  expect(found[0].line).toBe(1);
});

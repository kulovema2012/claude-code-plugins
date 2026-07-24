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

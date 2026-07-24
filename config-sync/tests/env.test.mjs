import { test, expect } from 'bun:test';
import { parseEnv, loadEnvFile } from '../lib/env.js';

test('parses KEY=VALUE, skipping comments and blanks', () => {
  // Arrange
  const text = '# comment\nKEY=val\n\nEMPTY=';
  // Act
  const result = parseEnv(text);
  // Assert
  expect(result).toEqual({ KEY: 'val', EMPTY: '' });
});

test('strips surrounding quotes', () => {
  // Arrange
  const text = 'A="quoted"\nB=\'single\'';
  // Act
  const result = parseEnv(text);
  // Assert
  expect(result).toEqual({ A: 'quoted', B: 'single' });
});

test('loadEnvFile returns {} when file is missing', async () => {
  // Arrange
  const fakeFs = {
    async readFile() { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; },
  };
  // Act
  const result = await loadEnvFile('/nope/.env.local', fakeFs);
  // Assert
  expect(result).toEqual({});
});

test('loadEnvFile reads via injected fs', async () => {
  // Arrange
  const fakeFs = { async readFile() { return 'X=1'; } };
  // Act
  const result = await loadEnvFile('/anywhere', fakeFs);
  // Assert
  expect(result).toEqual({ X: '1' });
});

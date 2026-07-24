import { test, expect } from 'bun:test';
import { renderTemplate } from '../lib/render.js';

test('substitutes known placeholders', () => {
  // Arrange
  const tmpl = '{"key": "{{CLAUDE_API_KEY}}", "home": "{{HOME}}/.codex"}';
  const ph = { CLAUDE_API_KEY: 'sk-real', HOME: 'C:/Users/new_k' };
  // Act
  const { rendered, missing } = renderTemplate(tmpl, ph);
  // Assert
  expect(rendered).toBe('{"key": "sk-real", "home": "C:/Users/new_k/.codex"}');
  expect(missing).toEqual([]);
});

test('reports missing placeholders by default', () => {
  const { rendered, missing } = renderTemplate('{{X}}', {});
  expect(missing).toEqual(['X']);
  expect(rendered).toBe('{{X}}'); // untouched
});

test('allowMissing leaves literal tokens for manual fill-in', () => {
  const { rendered, missing } = renderTemplate('{{X}}', {}, { allowMissing: true });
  expect(rendered).toBe('{{X}}');
  expect(missing).toEqual(['X']);
});

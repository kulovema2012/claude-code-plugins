// Dumb {{TOKEN}} substitution. Caller prepares values (incl. forward-slash HOME).

const TOKEN_RE = /\{\{(\w+)\}\}/g;

export function renderTemplate(text, placeholders, opts = {}) {
  const missing = new Set();
  const rendered = text.replace(TOKEN_RE, (full, name) => {
    if (Object.prototype.hasOwnProperty.call(placeholders, name)) {
      return String(placeholders[name]);
    }
    missing.add(name);
    return full; // leave literal whether or not allowMissing
  });
  return { rendered, missing: [...missing] };
}

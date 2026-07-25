#!/usr/bin/env node
/**
 * apply-skill-overrides.mjs
 * Runs at SessionStart. Injects skill patches into plugin cache versions
 * that haven't been patched yet. Safe to run multiple times — idempotent.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const HOME = homedir();
const OVERRIDES_DIR = join(HOME, '.claude', 'skill-overrides');
const PLUGIN_CACHE = join(HOME, '.claude', 'plugins', 'cache', 'claude-plugins-official');

// ─── Patch: writing-plans — Worktree Resolution ───────────────────────────────

function applyWritingPlansPatch(skillFile) {
  let content = readFileSync(skillFile, 'utf8');

  // Idempotency: already patched
  if (content.includes('## Worktree Resolution')) {
    return { applied: false, reason: 'already patched' };
  }

  const patchFile = join(OVERRIDES_DIR, 'writing-plans-worktree-section.md');
  if (!existsSync(patchFile)) {
    return { applied: false, reason: `patch file missing: ${patchFile}` };
  }
  const worktreeSection = readFileSync(patchFile, 'utf8').trimEnd();

  // Guard: verify injection markers exist in the upstream file
  const markers = [
    '## Scope Check',
    '**Tech Stack:** [Key technologies/libraries]',
    '**1. Spec coverage:**',
  ];
  const missing = markers.filter(m => !content.includes(m));
  if (missing.length > 0) {
    return { applied: false, reason: `upstream markers not found: ${missing.join(', ')}` };
  }

  // 1. Insert Worktree Resolution section before ## Scope Check
  content = content.replace(
    '## Scope Check',
    `${worktreeSection}\n\n---\n\n## Scope Check`
  );

  // 2. Add **Worktree:** field to the Plan Document Header template
  content = content.replace(
    '**Tech Stack:** [Key technologies/libraries]\n\n---',
    '**Tech Stack:** [Key technologies/libraries]\n\n**Worktree:** `<worktree-path>` (`<branch-name>`)\n\n---'
  );

  // 3. Improve frontmatter description
  content = content.replace(
    /^(description: Use when you have a spec or requirements for a multi-step task, before touching code)$/m,
    '$1. Always invoke before writing any implementation plan — even if the plan seems simple. ' +
    'Use proactively when the user says "implement", "build", "create a plan for", or "let\'s start on" any feature.'
  );

  // 4. Add Worktree check as step 1 of Self-Review and renumber existing steps
  content = content.replace(
    '**1. Spec coverage:**',
    '**1. Worktree check:** Is `**Worktree:**` filled with a real path and branch confirmed by `git worktree list`?\n\n**2. Spec coverage:**'
  );
  content = content.replace(/\*\*2\. Placeholder scan:\*\*/g, '**3. Placeholder scan:**');
  content = content.replace(/\*\*3\. Type consistency:\*\*/g, '**4. Type consistency:**');

  // 5. Add worktree reminder to the Remember section
  const rememberAnchor = '- DRY, YAGNI, TDD, frequent commits';
  if (content.includes(rememberAnchor)) {
    content = content.replace(
      rememberAnchor,
      `${rememberAnchor}\n- **Worktree always discovered, resolved, and stated in the header before writing any task**`
    );
  }

  writeFileSync(skillFile, content, 'utf8');
  return { applied: true };
}

// ─── Patch registry — add more patches here as needed ─────────────────────────

const PATCHES = [
  {
    plugin: 'superpowers',
    skill: 'writing-plans',
    apply: applyWritingPlansPatch,
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

let totalApplied = 0;
let totalFailed = 0;

for (const { plugin, skill, apply } of PATCHES) {
  const pluginDir = join(PLUGIN_CACHE, plugin);
  if (!existsSync(pluginDir)) continue;

  const versions = readdirSync(pluginDir).filter(v => /^\d+\.\d+\.\d+$/.test(v));

  for (const version of versions) {
    const skillFile = join(pluginDir, version, 'skills', skill, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    try {
      const result = apply(skillFile);
      if (result.applied) {
        console.log(`[skill-overrides] ${plugin}:${skill} patched → v${version}`);
        totalApplied++;
      }
    } catch (err) {
      console.error(`[skill-overrides] ${plugin}:${skill} v${version} FAILED: ${err.message}`);
      totalFailed++;
    }
  }
}

if (totalApplied === 0 && totalFailed === 0) {
  console.log('[skill-overrides] all patches already applied, nothing to do');
}

// implement-from-research.js
//
// Consumes the result of the `comprehensive-research` workflow and IMPLEMENTS
// something concrete from it: it turns the research synthesis into discrete,
// written artifacts (code, docs, config, or design specs) on disk, then
// verifies each one against the research evidence, then integrates them.
//
// Chaining: run `comprehensive-research`, then pass its return value here:
//
//   Workflow({
//     name: 'implement-from-research',
//     args: { research: <comprehensive-research return value>, outputPath: './out' }
//   })
//
// The research return shape it expects (all optional except that *some* signal
// of what to implement is present):
//   { task, domain, scope, lenses:[{lens,research,critique}], synthesis:{ ... } }
// where synthesis holds recommendedApproach[], implementationGuidance[],
// keyFindings[], risksAndUnknowns[], nextResearchSteps[].
//
// If the whole research object is passed bare (no `research` wrapper), that is
// detected automatically.

export const meta = {
  name: 'implement-from-research',
  description:
    'Implement concrete artifacts from a comprehensive-research result: plan units, build each, verify against the evidence, integrate.',
  whenToUse:
    'After running comprehensive-research, to turn its synthesis/recommendations into written files (code, docs, config, specs).',
  phases: [
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Verify' },
    { title: 'Integrate' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// args: the runtime serializes Workflow `args` to a string before this script
// sees it, so a JSON object arrives as JSON *text*. Normalize defensively.
// ─────────────────────────────────────────────────────────────────────────────
const input =
  typeof args === 'string'
    ? (() => {
        try {
          return JSON.parse(args)
        } catch {
          return args
        }
      })()
    : args

const brief = typeof input === 'string' ? { task: input } : input || {}

// The research result may arrive wrapped ({ research }) or bare (the object is
// itself the result, i.e. it has a top-level `synthesis`).
const research =
  brief.research || brief.result || (brief.synthesis ? brief : null) || {}

const task =
  brief.task || research.task || 'Implement the work implied by the provided research.'
const domain = research.domain || brief.domain || 'general'
const synthesis = research.synthesis || null
const scope = research.scope || null
const lenses = Array.isArray(research.lenses) ? research.lenses : []

const outputPath =
  brief.outputPath || brief.output || './research-implementation'

// Tuneables. clampMax keeps the build stage bounded (no open-ended loop).
const clampMax = (n, lo, hi, dflt) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return dflt
  return Math.min(hi, Math.max(lo, Math.trunc(v)))
}
const maxUnits = clampMax(brief.maxUnits, 1, 16, 10)
// Verify is on by default; pass { verify: false } to skip the whole stage.
const verify = brief.verify !== false
// Optional hint about what kind of artifact to favor when the research is open.
const deliverableHint = brief.deliverableHint || ''

// ─────────────────────────────────────────────────────────────────────────────
// Schemas — every agent whose result a later line reads a field off of gets one.
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_SCHEMA = {
  type: 'object',
  required: ['implementationType', 'rootPath', 'rationale', 'units'],
  properties: {
    implementationType: {
      type: 'string',
      description:
        'What kind of artifacts this research implies: code | document | configuration | design-spec | mixed',
    },
    rootPath: {
      type: 'string',
      description: 'Base directory (under outputPath) for all generated artifacts.',
    },
    rationale: {
      type: 'string',
      description: 'Why these units and this type follow from the synthesis.',
    },
    units: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'title',
          'what',
          'outputPath',
          'acceptanceCriteria',
        ],
        properties: {
          id: { type: 'string', description: 'Short stable slug, e.g. "auth-module".' },
          title: { type: 'string' },
          what: { type: 'string', description: 'Exactly what this unit produces.' },
          outputPath: {
            type: 'string',
            description:
              'MUST be unique across units. Project-relative path under rootPath. ' +
              'Two units must NEVER share the same path.',
          },
          language: {
            type: 'string',
            description: 'e.g. typescript, python, markdown, yaml. Omit if N/A.',
          },
          researchBasis: {
            type: 'array',
            items: { type: 'string' },
            description: 'Which findings/recommendations this unit draws on.',
          },
          acceptanceCriteria: {
            type: 'array',
            items: { type: 'string' },
            description: 'How to judge this unit done and correct.',
          },
          risksToAvoid: {
            type: 'array',
            items: { type: 'string' },
            description: 'Pitfalls/anti-patterns flagged by the research to steer around.',
          },
        },
      },
    },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  required: ['unitId', 'status', 'pathsWritten', 'summary'],
  properties: {
    unitId: { type: 'string' },
    status: {
      type: 'string',
      description: 'built | skipped | failed',
    },
    pathsWritten: {
      type: 'array',
      items: { type: 'string' },
      description: 'Every file path actually created or modified.',
    },
    summary: { type: 'string', description: 'What was produced, in 1-3 sentences.' },
    notes: { type: 'string', description: 'Caveats, TODOs, or follow-ups. May be empty.' },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['unitId', 'verdict', 'researchAlignment', 'issues'],
  properties: {
    unitId: { type: 'string' },
    verdict: {
      type: 'string',
      description: 'aligned | partial | misaligned',
    },
    researchAlignment: {
      type: 'string',
      description: 'How well the artifact reflects the cited research basis.',
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'issue'],
        properties: {
          severity: { type: 'string', description: 'blocker | major | minor' },
          issue: { type: 'string' },
          suggestion: { type: 'string' },
        },
      },
    },
  },
}

const INTEGRATE_SCHEMA = {
  type: 'object',
  required: ['rootPath', 'indexDocPath', 'summary', 'artifactMap'],
  properties: {
    rootPath: { type: 'string' },
    indexDocPath: {
      type: 'string',
      description: 'Path to the README/index the integrator writes tying it all together.',
    },
    summary: {
      type: 'string',
      description: 'High-level description of the implementation produced.',
    },
    artifactMap: {
      type: 'array',
      items: {
        type: 'object',
        required: ['unitId', 'paths', 'mapsTo'],
        properties: {
          unitId: { type: 'string' },
          paths: { type: 'array', items: { type: 'string' } },
          mapsTo: { type: 'string', description: 'Which research recommendation this satisfies.' },
        },
      },
    },
    gaps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Known gaps / nextResearchSteps not yet addressed.',
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — Plan: one agent decomposes the research into bounded build units.
// This is the only single-point step; everything after fans out over the list.
// ─────────────────────────────────────────────────────────────────────────────
phase('Plan')

const researchDigest = JSON.stringify({
  task,
  domain,
  domainTags: scope?.domainTags || [],
  hasSynthesis: !!synthesis,
  synthesis,
  lensCount: lenses.length,
  lensSummaries: lenses.map((l) => ({
    lens: l?.lens?.title || l?.lens?.key,
    summary: l?.research?.summary,
    keyFindings: (l?.research?.findings || []).map((f) => f?.claim).filter(Boolean),
  })),
})

const planPrompt = [
  `You are planning an IMPLEMENTATION from completed research.`,
  ``,
  `DOMAIN: ${domain}`,
  `TASK: ${task}`,
  `OUTPUT BASE DIRECTORY: ${outputPath}`,
  deliverableHint ? `DELIVERABLE HINT: ${deliverableHint}` : '',
  ``,
  `Here is the research result (synthesis + lens summaries) as JSON:`,
  researchDigest,
  ``,
  `Decide what concrete, BUILDABLE artifacts this research implies and decompose them`,
  `into discrete, independently-implementable units.`,
  ``,
  `Rules:`,
  `1. Each unit must produce ONE primary artifact and MUST have a UNIQUE outputPath`,
  `   under the output base. No two units may share a path. Shared/cross-cutting`,
  `   files (package.json, index, README, glue code) are NOT a unit — the integrator`,
  `   owns those.`,
  `2. Derive units from synthesis.recommendedApproach and synthesis.implementationGuidance`,
  `   primarily; use keyFindings to justify and risksToAvoid to warn.`,
  `3. Keep units small enough to be built by one agent in one pass (a module, a doc`,
  `   section, a config file, a design spec) — not a whole app.`,
  `4. Emit between 1 and ${maxUnits} units. Prefer fewer, high-signal units.`,
  `5. rootPath must be a subdirectory under the output base.`,
  `6. Set implementationType honestly (code/document/configuration/design-spec/mixed).`,
  `7. If the research genuinely implies NO buildable artifact, return an empty units array`,
  `   and explain why in rationale.`,
].join('\n')

const plan = await agent(planPrompt, {
  label: 'plan:decompose',
  phase: 'Plan',
  schema: PLAN_SCHEMA,
  stallMs: 300000,
})

const allUnits = (plan?.units || []).slice(0, maxUnits)
// Guarantee unique paths defensively (the planner is told to, but enforce it).
const seenPaths = new Set()
const units = allUnits.filter((u) => {
  const p = u?.outputPath
  if (!p || seenPaths.has(p)) return false
  seenPaths.add(p)
  return true
})

log(
  `Plan ready: type=${plan?.implementationType || '?'} · ${units.length} buildable unit(s)` +
    (allUnits.length > units.length ? ` (dropped ${allUnits.length - units.length} dup-path)` : ''),
)

// Nothing to build? Stop cleanly — return the plan so the caller knows why.
if (units.length === 0) {
  return {
    status: 'no-units',
    implementationType: plan?.implementationType || null,
    rootPath: plan?.rootPath || outputPath,
    rationale: plan?.rationale || 'No buildable units were derived from the research.',
    unitsBuilt: 0,
    units: [],
    integration: null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phases 2–3 — Build → Verify, pipelined per unit (no barrier).
// A unit verifies the moment ITS build returns; slow builds don't stall fast ones.
// ─────────────────────────────────────────────────────────────────────────────
phase('Build')

const results = await pipeline(
  units,
  // Stage 1 — Build: write the artifact for this unit.
  (unit) =>
    agent(
      [
        `You are a builder. Create the artifact described below and write it to disk.`,
        ``,
        `DOMAIN: ${domain}`,
        `TASK: ${task}`,
        `ROOT PATH: ${plan.rootPath || outputPath}`,
        `OUTPUT PATH (write here): ${unit.outputPath}`,
        unit.language ? `LANGUAGE/FORMAT: ${unit.language}` : '',
        ``,
        `UNIT:`,
        JSON.stringify(unit, null, 2),
        ``,
        `Do the work: use your file tools to create the artifact at OUTPUT PATH`,
        `(creating parent directories as needed). Honor researchBasis and steer clear of`,
        `anything in risksToAvoid. Then return this structured result naming exactly what`,
        `you wrote. Set status='built' on success, 'skipped' if you deliberately produced`,
        `nothing, 'failed' only if you could not proceed.`,
      ].join('\n'),
      { label: `build:${unit.id}`, phase: 'Build', schema: BUILD_SCHEMA },
    ),
  // Stage 2 — Verify (optional): adversarial check vs the research, only if build ok.
  verify
    ? (build, unit) => {
        if (!build || build.status !== 'built') {
          return { unit, build, verify: null }
        }
        return agent(
          [
            `You are a skeptical reviewer. Does the built artifact actually follow the research?`,
            `Try to find misalignment with the research basis.`,
            ``,
            `UNIT:`,
            JSON.stringify(unit, null, 2),
            ``,
            `BUILD RESULT:`,
            JSON.stringify(build, null, 2),
            ``,
            `Inspect the files at the paths in pathsWritten. Then judge: does the artifact`,
            `meet acceptanceCriteria, reflect researchBasis, and avoid risksToAvoid?`,
            `Set verdict 'aligned' / 'partial' / 'misaligned' and list concrete issues.`,
          ].join('\n'),
          {
            label: `verify:${unit.id}`,
            phase: 'Verify',
            schema: VERIFY_SCHEMA,
          },
        ).then((v) => ({ unit, build, verify: v }))
      }
    : (build, unit) => ({ unit, build, verify: null }),
)

// Pipeline leaves null holes for any item that threw/skipped/dropped.
const clean = results.filter(Boolean)
const built = clean.filter((r) => r.build && r.build.status === 'built')

log(
  `Built ${built.length}/${units.length} unit(s)` +
    (verify
      ? ` · verified: ${
          built.filter((r) => r.verify && r.verify.verdict !== 'misaligned').length
        } aligned`
      : ''),
)

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Integrate: one agent writes an index doc mapping artifacts → research.
// This is the genuine barrier: it needs ALL built units. Awaiting the pipeline
// above IS that barrier, so this is a plain single-agent step.
// ─────────────────────────────────────────────────────────────────────────────
phase('Integrate')

const integration = await agent(
  [
    `You are the integrator. Tie the built artifacts into one coherent implementation.`,
    ``,
    `DOMAIN: ${domain}`,
    `TASK: ${task}`,
    `ROOT PATH: ${plan.rootPath || outputPath}`,
    `IMPLEMENTATION TYPE: ${plan.implementationType || 'mixed'}`,
    ``,
    `BUILT UNITS (unit + build + verify):`,
    JSON.stringify(
      clean.map((r) => ({
        id: r.unit.id,
        title: r.unit.title,
        output: r.unit.outputPath,
        status: r.build?.status,
        paths: r.build?.pathsWritten || [],
        verdict: r.verify?.verdict,
        issues: r.verify?.issues || [],
      })),
      null,
      2,
    ),
    ``,
    `Write a README/index doc under ROOT PATH that: lists every artifact and which`,
    `research recommendation it satisfies; explains how to use the implementation; and`,
    `records gaps (draw on synthesis.nextResearchSteps where available). Create any glue`,
    `files only if a built unit clearly depends on one that no unit produced. Return the`,
    `structured result with indexDocPath pointing at what you wrote.`,
  ].join('\n'),
  {
    label: 'integrate:index',
    phase: 'Integrate',
    schema: INTEGRATE_SCHEMA,
    stallMs: 300000,
  },
)

// Reference every named const that appears only in the return, so the linter's
// noUnusedLocals pass (which mis-flags top-level `return` as unreachable) sees use.
log(
  `Done. type=${plan.implementationType || '?'} root=${integration?.rootPath || plan.rootPath}` +
    ` units=${built.length} index=${integration?.indexDocPath || '(none)'}`,
)

return {
  status: 'implemented',
  implementationType: plan.implementationType,
  rootPath: integration?.rootPath || plan.rootPath || outputPath,
  rationale: plan.rationale,
  unitsBuilt: built.length,
  unitsTotal: units.length,
  units: clean,
  integration: integration,
}

export const meta = {
  name: 'comprehensive-research',
  description: 'Run source-backed, multi-lens research on ANY topic. Detects the research domain (scientific, humanities, technical, product/UX, market, financial, legal, current events, comparative, how-to, and more) and adapts the lenses and source strategy accordingly.',
  whenToUse: 'Before making decisions or implementing work that benefits from current examples, best practices, risks, and evidence. Works for any subject, not just product or engineering.',
  phases: [
    { title: 'Scope' },
    { title: 'Research' },
    { title: 'Critique', model: 'haiku' },
    { title: 'Synthesize' },
  ],
}

// ── args normalization ──────────────────────────────────────────────
// The runtime serializes `args` to a string before the script runs, so a
// JSON object arrives as JSON *text*. Normalize it: JSON string parses to
// an object, bare text falls through, undefined becomes {}.
const input = typeof args === 'string'
  ? (() => { try { return JSON.parse(args) } catch { return args } })()
  : args

const brief = typeof input === 'string'
  ? { task: input }
  : (input || {})

const task = brief.task || brief.goal || brief.prompt || brief.topic || brief.question || 'Research the topic comprehensively and produce an actionable briefing.'
const context = brief.context || ''
const audience = brief.audience || 'the person or AI agent doing the work'
const deliverable = brief.deliverable || 'an actionable research briefing'
const constraints = Array.isArray(brief.constraints) ? brief.constraints : []
const successCriteria = Array.isArray(brief.successCriteria) ? brief.successCriteria : []
const requestedLenses = Array.isArray(brief.lenses) ? brief.lenses : []
const requestedDomain = typeof brief.domain === 'string' && brief.domain.trim() ? brief.domain.trim() : ''
const breadth = Number.isFinite(brief.breadth) ? Math.min(12, Math.max(3, Math.round(brief.breadth))) : null
const userSourceExpectations = brief.sourceExpectations || ''

// ── domain taxonomy ─────────────────────────────────────────────────
// The scope agent classifies the topic into one primary domain (plus
// optional secondary tags) from this list. Each domain carries its own
// source strategy below.
const DOMAINS = [
  'scientific',              // research, medical, physics, biology, etc.
  'academic-humanities',     // history, philosophy, literature, linguistics
  'technical',               // software, engineering, tools, infrastructure
  'product-ux',              // design, frontend, apps, conversion, onboarding
  'market-business',         // competitive landscape, strategy, industry
  'financial-economic',      // markets, investing, macro/micro economics
  'legal-regulatory',        // law, compliance, regulation, policy
  'current-events',          // news, time-sensitive, fast-moving
  'comparative-decision',    // choosing between options, tradeoffs
  'how-to-practical',        // instructions, guides, techniques
  'data-statistical',        // metrics, datasets, quantitative analysis
  'social-cultural',         // society, ethics, cultural phenomena
  'biographical-entity',     // people, organizations, specific entities
  'general-knowledge',       // anything else; the safe fallback
]

// ── lens archetype catalog ──────────────────────────────────────────
// A vocabulary of reusable research lenses spanning domains. The scope
// agent treats this as a MENU: it selects and adapts the most relevant
// lenses to the detected domain and the specific task. The `domains` field
// is advisory (which domains a lens most often serves); matching is
// semantic, not exact-string.
const LENS_ARCHETYPES = [
  { key: 'landscape', title: 'Landscape and Current State', domains: 'all', purpose: 'What is the current state, who are the key players, and what dominant patterns exist?' },
  { key: 'definitions-fundamentals', title: 'Definitions and Fundamentals', domains: 'all', purpose: 'What core concepts, terminology, and mental models must a non-expert understand first?' },
  { key: 'best-practices-standards', title: 'Best Practices and Standards', domains: 'technical, product-ux, how-to-practical', purpose: 'What authoritative standards, conventions, and proven practices apply?' },
  { key: 'ux-visual-benchmarks', title: 'UX and Visual Benchmarks', domains: 'product-ux', purpose: 'What should we learn from strong real-world products, flows, layouts, and interaction patterns?' },
  { key: 'audience-jobs-needs', title: 'Audience, Jobs, and Needs', domains: 'product-ux, market-business, social-cultural', purpose: 'What user/stakeholder needs, motivations, objections, and success criteria matter most?' },
  { key: 'implementation-constraints', title: 'Implementation and Operational Constraints', domains: 'technical, product-ux', purpose: 'What practical dependencies, edge cases, performance, and maintenance concerns apply?' },
  { key: 'risks-tradeoffs-antipatterns', title: 'Risks, Tradeoffs, and Anti-Patterns', domains: 'all', purpose: 'What can go wrong, what advice conflicts, and what common mistakes should be avoided?' },
  { key: 'evidence-primary-sources', title: 'Primary Evidence and Sources', domains: 'scientific, academic-humanities, legal-regulatory, current-events', purpose: 'What are the authoritative primary sources, datasets, statutes, or original documents?' },
  { key: 'methodology-critique', title: 'Methodology and Quality of Evidence', domains: 'scientific, academic-humanities, data-statistical', purpose: 'How sound is the evidence — sample sizes, study design, peer review, provenance, bias?' },
  { key: 'historical-context', title: 'Historical Context and Origins', domains: 'academic-humanities, scientific, social-cultural', purpose: 'How did this develop over time, and what history explains the present?' },
  { key: 'market-competitive', title: 'Market and Competitive Landscape', domains: 'market-business, financial-economic', purpose: 'Who competes, and what are the dynamics, positioning, and structure?' },
  { key: 'financial-economics', title: 'Financial and Economic Drivers', domains: 'financial-economic, market-business', purpose: 'What are the economics, costs, revenues, and financial signals?' },
  { key: 'legal-regulatory', title: 'Legal, Regulatory, and Compliance', domains: 'legal-regulatory, market-business', purpose: 'What laws, regulations, jurisdictions, and compliance obligations apply?' },
  { key: 'current-state-recency', title: 'Latest Developments and Currency', domains: 'current-events, technical, scientific, legal-regulatory', purpose: 'What has changed most recently, and what is the state as of today?' },
  { key: 'comparative-tradeoffs', title: 'Comparative Tradeoffs', domains: 'comparative-decision, technical, market-business', purpose: 'How do the options differ on what matters, and what are the tradeoffs?' },
  { key: 'stakeholder-controversies', title: 'Stakeholder Views and Controversies', domains: 'social-cultural, academic-humanities, market-business', purpose: 'Where do reasonable people disagree, and what are the main competing positions?' },
  { key: 'how-to-practical', title: 'Practical How-To and Worked Examples', domains: 'how-to-practical, technical', purpose: 'What are the concrete steps, common pitfalls, and real worked examples?' },
  { key: 'data-metrics', title: 'Data, Metrics, and Quantitative Evidence', domains: 'data-statistical, market-business, scientific, financial-economic', purpose: 'What numbers, benchmarks, and datasets bear on this?' },
  { key: 'case-studies-examples', title: 'Case Studies and Real Examples', domains: 'all', purpose: 'What concrete real-world examples and case studies illustrate this in practice?' },
  { key: 'counterarguments-skeptical', title: 'Counterarguments and Skeptical View', domains: 'all', purpose: 'What is the strongest case against the conventional view, and what is overstated?' },
  { key: 'regional-cultural-context', title: 'Regional and Cultural Context', domains: 'social-cultural, market-business, academic-humanities', purpose: 'How does geography, culture, or region change the answer?' },
  { key: 'key-figures-entities', title: 'Key Figures and Entities', domains: 'biographical-entity, market-business, academic-humanities', purpose: 'Who are the influential people, organizations, or entities central to this?' },
]

// ── domain source profiles ──────────────────────────────────────────
// How to source and verify per domain. The detected (or user-supplied)
// domain selects one; unknown domains fall back to general-knowledge.
const DOMAIN_PROFILES = {
  scientific: {
    recency: 'moderate — prefer the latest peer-reviewed work, but foundational older papers remain authoritative',
    preferredSources: 'peer-reviewed journals, systematic reviews and meta-analyses, primary studies, official datasets, reputable preprint servers (clearly flagged as non-peer-reviewed)',
    verification: 'Distinguish peer-reviewed from preprint. Note sample size, study design, replicability, funding, and conflicts of interest. Separate established consensus from a single study.',
  },
  'academic-humanities': {
    recency: 'low — primary sources and seminal scholarship may be decades or centuries old; currency is about historiography, not the source date',
    preferredSources: 'primary sources and archival documents, peer-reviewed scholarship, reference works, reputable scholarly editions, museum and curatorial records',
    verification: 'Distinguish primary from secondary sources. Note where scholars disagree (historiography). Attribute interpretations and note their evidence base.',
  },
  technical: {
    recency: 'high — tools, frameworks, and APIs change quickly; verify against current versions',
    preferredSources: 'official documentation, source code and repositories, release notes and changelogs, RFCs and specs, reputable engineering writing, reproducible benchmarks',
    verification: 'Match the documentation version to the product version in question. Watch for vendor marketing and outdated tutorials. Prefer primary docs over secondary explainers.',
  },
  'product-ux': {
    recency: 'high — live products and patterns shift constantly',
    preferredSources: 'live products and competitors, official design systems, reputable UX research and case studies, accessibility standards, analytics-backed writing',
    verification: 'Treat observed patterns as evidence, not rules — context and audience change what works. Separate opinion from measured outcomes.',
  },
  'market-business': {
    recency: 'high — markets move; check dates on all figures',
    preferredSources: 'company official sources and filings, reputable market analysis, industry reports, business press, primary customer and review data',
    verification: 'Note sponsorship and paid placement in analyst content. Distinguish estimates and forecasts from reported figures. Check dates and geographies.',
  },
  'financial-economic': {
    recency: 'high — economic data is revised and forecasts expire',
    preferredSources: 'official statistical agencies and central-bank data, regulatory filings, reputable financial analysis, primary economic releases',
    verification: 'Separate forecast from realized data. Note revision risk, methodology changes, and the date of each figure. Flag conflicts of interest.',
  },
  'legal-regulatory': {
    recency: 'high — law and regulation change; cite the controlling jurisdiction',
    preferredSources: 'statute and regulation text, official regulatory guidance, case law and court opinions, government publications, reputable practitioner analysis',
    verification: 'Always state jurisdiction. Confirm a provision is still in force and check for recent amendments. Surface the controlling text rather than giving legal advice.',
  },
  'current-events': {
    recency: 'critical — this is time-sensitive and volatile',
    preferredSources: 'reputable news organizations, official statements, primary documents (press releases, filings, recordings); corroborate across independent outlets',
    verification: 'Breaking information changes. Cross-check key claims across independent sources. Flag unverified reports and rumors explicitly. Note each item date.',
  },
  'comparative-decision': {
    recency: 'moderate — ensure comparisons reflect the current state of each option',
    preferredSources: 'direct head-to-head comparisons, vendor-neutral benchmarks, independent reviews, real-world usage reports, official specs for each option',
    verification: 'Beware sponsored or vendor-authored comparisons. Confirm compared items are peers (same class and version). Surface decision-relevant tradeoffs, not just feature lists.',
  },
  'how-to-practical': {
    recency: 'moderate — prefer recent guides for tools and tech; durable principles for crafts',
    preferredSources: 'official guides and documentation, reputable tutorials, community-vetted answers with high reputation, real worked examples',
    verification: 'Confirm steps actually reproduce. Prefer recent material for evolving tools. Note where advice is version-specific.',
  },
  'data-statistical': {
    recency: 'high for datasets that update; note the vintage',
    preferredSources: 'official statistical agencies, reputable datasets and data portals, peer-reviewed analyses, methodology documentation',
    verification: 'State source, vintage, methodology, and known caveats. Watch for sampling bias, definitional differences across sources, and selective reporting.',
  },
  'social-cultural': {
    recency: 'moderate — mix current discussion with established scholarship',
    preferredSources: 'peer-reviewed social science, reputable journalism, original statements from involved parties, polling and survey data, primary cultural artifacts',
    verification: 'Represent competing viewpoints fairly. Separate measured trends from anecdote. Note whose perspective a source represents.',
  },
  'biographical-entity': {
    recency: 'moderate — confirm against current authoritative records',
    preferredSources: 'official biographies and organizational pages, reputable reference works, primary records, credible journalism',
    verification: 'Cross-check biographical claims against multiple sources. Note conflicts of interest for self-published material. Flag unverified claims.',
  },
  'general-knowledge': {
    recency: 'moderate — prefer current, clearly dated material when recency matters',
    preferredSources: 'primary and authoritative sources, official documentation, reputable expert writing, established reference works',
    verification: 'Prefer primary over secondary sources. Note evidence strength and date. Flag uncertainty.',
  },
}

function resolveProfile(domain) {
  const key = typeof domain === 'string' && domain.trim() ? domain.trim() : 'general-knowledge'
  return DOMAIN_PROFILES[key] || DOMAIN_PROFILES['general-knowledge']
}

const SCOPE_SCHEMA = {
  type: 'object',
  required: ['taskRestatement', 'domain', 'researchQuestions', 'lensPlan'],
  properties: {
    taskRestatement: { type: 'string' },
    domain: { type: 'string', description: 'The primary research domain chosen from the taxonomy' },
    domainTags: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
    researchQuestions: { type: 'array', items: { type: 'string' } },
    lensPlan: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'title', 'question', 'method'],
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          question: { type: 'string' },
          method: { type: 'string' },
          sourceTargets: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const RESEARCH_SCHEMA = {
  type: 'object',
  required: ['lensKey', 'summary', 'findings', 'recommendations'],
  properties: {
    lensKey: { type: 'string' },
    summary: { type: 'string' },
    searchLog: { type: 'array', items: { type: 'string' } },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'locator', 'whyItMatters'],
        properties: {
          title: { type: 'string' },
          locator: { type: 'string' },
          date: { type: 'string' },
          sourceType: { type: 'string' },
          whyItMatters: { type: 'string' },
        },
      },
    },
    examples: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'whatToStudy'],
        properties: {
          name: { type: 'string' },
          locator: { type: 'string' },
          whatToStudy: { type: 'string' },
          transferablePattern: { type: 'string' },
        },
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'evidence', 'confidence', 'implication'],
        properties: {
          claim: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string' },
          implication: { type: 'string' },
        },
      },
    },
    recommendations: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
}

const CRITIQUE_SCHEMA = {
  type: 'object',
  required: ['verdict', 'strongestEvidence', 'weakSpots', 'actionableCorrections'],
  properties: {
    verdict: { type: 'string' },
    strongestEvidence: { type: 'array', items: { type: 'string' } },
    weakSpots: { type: 'array', items: { type: 'string' } },
    missingResearch: { type: 'array', items: { type: 'string' } },
    sourceQualityNotes: { type: 'array', items: { type: 'string' } },
    actionableCorrections: { type: 'array', items: { type: 'string' } },
  },
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  required: ['executiveSummary', 'keyFindings', 'recommendedApproach', 'implementationGuidance', 'sourceNotes'],
  properties: {
    executiveSummary: { type: 'string' },
    keyFindings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['finding', 'whyItMatters', 'confidence'],
        properties: {
          finding: { type: 'string' },
          whyItMatters: { type: 'string' },
          confidence: { type: 'string' },
          sourceRefs: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    recommendedApproach: { type: 'array', items: { type: 'string' } },
    implementationGuidance: {
      type: 'array',
      items: {
        type: 'object',
        required: ['area', 'guidance'],
        properties: {
          area: { type: 'string' },
          guidance: { type: 'string' },
          examplesToReference: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    risksAndUnknowns: { type: 'array', items: { type: 'string' } },
    nextResearchSteps: { type: 'array', items: { type: 'string' } },
    sourceNotes: { type: 'array', items: { type: 'string' } },
  },
}

// ── domain-agnostic fallback ────────────────────────────────────────
// Used only if the scope agent returns no lenses. Deliberately general so
// it is reasonable for ANY topic; the scope agent normally produces a
// tailored, domain-specific set drawn from the catalog above.
const FALLBACK_LENS_PLAN = [
  { key: 'landscape', title: 'Landscape and Current State', question: 'What is the current state of this topic, who are the key players, and what dominant patterns exist?', method: 'Survey current examples, key actors, and widely repeated patterns.', sourceTargets: ['current public examples', 'reputable analysis', 'primary or official sources'] },
  { key: 'definitions-fundamentals', title: 'Definitions and Fundamentals', question: 'What core concepts and terminology must be understood first?', method: 'Establish authoritative definitions and the mental model.', sourceTargets: ['reference works', 'official documentation', 'reputable expert writing'] },
  { key: 'evidence-primary-sources', title: 'Primary Evidence and Sources', question: 'What are the authoritative primary sources for this topic?', method: 'Identify the most authoritative original sources, datasets, or documents.', sourceTargets: ['primary sources', 'official records', 'authoritative references'] },
  { key: 'risks-tradeoffs', title: 'Risks, Tradeoffs, and Anti-Patterns', question: 'What can go wrong and what common mistakes should be avoided?', method: 'Search for failure cases, critiques, limitations, and counterexamples.', sourceTargets: ['critiques', 'postmortems', 'expert analysis'] },
  { key: 'case-studies-examples', title: 'Case Studies and Real Examples', question: 'What concrete examples illustrate this in practice?', method: 'Collect real-world examples and extract transferable patterns.', sourceTargets: ['case studies', 'real examples', 'documented outcomes'] },
  { key: 'counterarguments-skeptical', title: 'Counterarguments and Skeptical View', question: 'What is the strongest case against the conventional view?', method: 'Surface competing positions and where the consensus may be overstated.', sourceTargets: ['critiques', 'alternative viewpoints', 'reputable dissent'] },
]

// Defensive normalization so downstream stages always have a stable key
// and the required fields, regardless of what the scope agent returned.
function normalizeLens(lens) {
  if (!lens || typeof lens !== 'object') return null
  const raw = (lens.key || lens.title || 'lens').toString().toLowerCase()
  const key = raw.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'lens'
  return {
    key: key,
    title: lens.title || key,
    question: lens.question || '',
    method: lens.method || '',
    sourceTargets: Array.isArray(lens.sourceTargets) ? lens.sourceTargets : [],
  }
}

// Condense a research result for the critique agent. The full research
// blob (search log + verbose per-source/per-example rationale) can exceed
// the cheap critique model's context window on rich topics. Refutation
// only needs the claims + their evidence, the source identities, and the
// recommendations — so we keep those and drop the rest.
function condenseResearch(r) {
  return {
    lensKey: r.lensKey,
    summary: r.summary,
    findings: (r.findings || []).map(f => ({ claim: f.claim, confidence: f.confidence, evidence: f.evidence })),
    sources: (r.sources || []).map(s => ({ title: s.title, locator: s.locator, sourceType: s.sourceType, date: s.date })),
    recommendations: r.recommendations || [],
    openQuestions: r.openQuestions || [],
  }
}

// ── Scope: classify the domain and plan domain-appropriate lenses ────
phase('Scope')
const scopePrompt =
  'Turn this work request into a focused, domain-aware research plan that works for ANY topic.\n\n'
  + 'Task:\n' + task + '\n\n'
  + 'Context:\n' + context + '\n\n'
  + 'Audience:\n' + audience + '\n\n'
  + 'Expected deliverable:\n' + deliverable + '\n\n'
  + 'Constraints:\n' + JSON.stringify(constraints, null, 2) + '\n\n'
  + 'Success criteria:\n' + JSON.stringify(successCriteria, null, 2) + '\n\n'
  + (requestedLenses.length ? 'Requested lenses (honor these when relevant):\n' + JSON.stringify(requestedLenses, null, 2) + '\n\n' : '')
  + (requestedDomain ? 'User-specified domain (use this as the primary domain):\n' + requestedDomain + '\n\n' : '')
  + 'Step 1 — Classify the domain. Choose the single primary domain that best fits the topic from this taxonomy:\n'
  + DOMAINS.join(', ') + '\n'
  + 'Also add domainTags for any secondary domains that apply.\n\n'
  + 'Step 2 — Choose ' + (breadth ? breadth + ' research lenses' : 'between 4 and 8 research lenses')
  + ' by selecting and ADAPTING from this menu of lens archetypes (refine titles, questions, and methods to fit the specific topic):\n'
  + JSON.stringify(LENS_ARCHETYPES, null, 2) + '\n\n'
  + 'Pick the lenses most relevant to the detected domain and task. Guidance by domain (adapt to the topic, do not force lenses that do not fit):\n'
  + '- product-ux / frontend: include UX/visual benchmarks and audience/jobs lenses.\n'
  + '- technical: include implementation constraints and a latest-developments (recency) lens.\n'
  + '- scientific / academic-humanities: include primary-evidence and methodology-critique lenses.\n'
  + '- market-business / financial-economic: include competitive-landscape and financial-economics lenses.\n'
  + '- legal-regulatory: include the legal-regulatory lens, naming the controlling jurisdiction.\n'
  + '- current-events: include a latest-developments lens and emphasize recency.\n'
  + '- comparative-decision: include comparative-tradeoffs and a skeptical-view lens.\n'
  + '- how-to-practical: include practical how-to and case-studies lenses.\n'
  + '- any domain: it is usually worth including risks/anti-patterns and a counterarguments lens.\n\n'
  + 'Each lens must be independently researchable and source-backed, with key, title, question, method, and sourceTargets.'

const scoped = await agent(
  scopePrompt,
  { label: 'scope-research-plan', phase: 'Scope', schema: SCOPE_SCHEMA }
)

const lensPlan = ((scoped && Array.isArray(scoped.lensPlan) && scoped.lensPlan.length)
  ? scoped.lensPlan
  : FALLBACK_LENS_PLAN)
  .map(normalizeLens)
  .filter(l => l && l.key)
  .slice(0, breadth || 8)

const domain = (scoped && typeof scoped.domain === 'string' && scoped.domain.trim())
  ? scoped.domain.trim()
  : (requestedDomain || 'general-knowledge')
const profile = resolveProfile(domain)

const sourceStrategy =
  'Recency priority: ' + profile.recency + '.\n'
  + 'Preferred source types: ' + profile.preferredSources + '.\n'
  + 'Verification: ' + profile.verification + '.'
  + (userSourceExpectations ? '\n\nAdditional source expectations from the request (apply these too):\n' + userSourceExpectations : '')

log('Domain: ' + domain + ' — researching ' + lensPlan.length + ' lenses for: ' + task)

// ── Research + Critique: one pipeline, no barrier between stages ─────
// Each lens is researched, then immediately critiqued; lens A can be
// critiqued while lens B is still being researched.
const lensResults = await pipeline(
  lensPlan,
  (lens, _originalLens, index) => agent(
    'Research this lens comprehensively and return source-backed findings. Adapt your method to the lens and to the topic — there is no single correct way to research; match your sources and approach to what the question actually needs.\n\n'
    + 'Overall task:\n' + task + '\n\n'
    + 'Detected domain:\n' + domain + '\n\n'
    + 'Context:\n' + context + '\n\n'
    + 'Audience:\n' + audience + '\n\n'
    + 'Deliverable:\n' + deliverable + '\n\n'
    + 'Source strategy for this domain:\n' + sourceStrategy + '\n\n'
    + 'Research lens:\n' + JSON.stringify(lens, null, 2) + '\n\n'
    + 'Instructions:\n'
    + '- Match the domain: use the preferred source types and recency priority above. For scientific/academic topics favor peer-reviewed primary sources; for current-events prioritize recency and cross-check across independent outlets; for product/frontend work study real current examples and extract transferable patterns; for technical work use official docs and source; for legal work cite the controlling jurisdiction; for comparative work weigh real tradeoffs.\n'
    + '- Use web research when recency, popularity, examples, laws, standards, tools, products, or best practices may have changed.\n'
    + '- Use local repository or file inspection when the task is tied to an implementation artifact.\n'
    + '- Prefer primary or authoritative sources. Always include locators: URLs, document or section titles, local file paths, dataset names, statute citations, or DOIs.\n'
    + '- Separate observed evidence from inference. Explicitly flag claims with weak, missing, dated, contested, or non-peer-reviewed evidence.\n'
    + '- Keep findings actionable for the expected deliverable.',
    { label: 'research:' + (lens.key || index), phase: 'Research', schema: RESEARCH_SCHEMA, stallMs: 300000 }
  ),
  (research, originalLens, index) => {
    if (!research) return { lens: originalLens, research: research, critique: null }
    return agent(
      'Critique and verify this research lens. Try to refute weak claims, judge whether the sources match what this domain requires, identify missing sources, and convert vague advice into concrete corrections.\n\n'
      + 'Overall task:\n' + task + '\n\n'
      + 'Detected domain:\n' + domain + '\n\n'
      + 'Domain source expectations:\n' + sourceStrategy + '\n\n'
      + 'Lens:\n' + JSON.stringify(originalLens, null, 2) + '\n\n'
      + 'Research result (condensed — claims with evidence, source identities, and recommendations; full prose, search log, and per-source rationale omitted to fit the window):\n' + JSON.stringify(condenseResearch(research), null, 2),
      { label: 'critique:' + (originalLens.key || index), phase: 'Critique', schema: CRITIQUE_SCHEMA, model: 'haiku' }
    ).then(critique => ({ lens: originalLens, research: research, critique: critique }))
  }
)

const cleanLensResults = lensResults.filter(Boolean)

// ── Synthesize: write the final, domain-aware deliverable ───────────
phase('Synthesize')
const synthesis = await agent(
  'Synthesize the research into the final deliverable.\n\n'
  + 'Task:\n' + task + '\n\n'
  + 'Detected domain:\n' + domain + '\n\n'
  + 'Context:\n' + context + '\n\n'
  + 'Audience:\n' + audience + '\n\n'
  + 'Expected deliverable:\n' + deliverable + '\n\n'
  + 'Success criteria:\n' + JSON.stringify(successCriteria, null, 2) + '\n\n'
  + 'Research questions:\n' + JSON.stringify((scoped && scoped.researchQuestions) || [], null, 2) + '\n\n'
  + 'Lens research and critiques:\n' + JSON.stringify(cleanLensResults, null, 2) + '\n\n'
  + 'Write for an AI agent or human who will act on this immediately. Prioritize decisions, patterns to copy, anti-patterns to avoid, implementation implications, and citations/locators. Explicitly mark claims that depend on uncertain, stale, contested, or non-peer-reviewed evidence.',
  { label: 'final-research-briefing', phase: 'Synthesize', schema: SYNTHESIS_SCHEMA, stallMs: 300000 }
)
log('Briefing synthesized across ' + cleanLensResults.length + ' lenses for domain "' + domain + '"' + (synthesis ? '' : ' — synthesis agent returned no result'))

return {
  task: task,
  domain: domain,
  domainTags: (scoped && scoped.domainTags) || [],
  scope: scoped,
  lensCount: cleanLensResults.length,
  lenses: cleanLensResults,
  synthesis: synthesis,
}

// e2e-test-and-fix.js
// Comprehensive end-to-end test of a RUNNING app across every feature/button/form,
// then an iterative fix->reload->retest loop (with auto-commit) for anything that
// fails. Pluggable driver: web UI via Playwright, HTTP API via curl.
//
// Run with:  Workflow({ name: 'e2e-test-and-fix', args: { baseUrl, sourcePath, ... } })
//            (requires CLAUDE_CODE_WORKFLOWS=1)
//
// Why this topology:
//   - Discovery and testing are READ-ONLY, so they fan out safely in `parallel`.
//   - Fixing is STATEFUL (edits shared source + git commits), so it runs SERIALLY
//     (a plain for..of loop, one fix agent at a time). Two agents editing the same
//     repo + committing concurrently would clobber each other. Serial is both the
//     safe and the human-intuitive order: one change, re-run, repeat.
//   - The Test phase is a real barrier: the serial Fix phase needs the COMPLETE
//     failure set in hand before it starts. That is the one legitimate reason to
//     reach for `parallel` over `pipeline`.

export const meta = {
  name: 'e2e-test-and-fix',
  description: 'Comprehensively e2e-test every feature/button/form/endpoint of a running app, then iteratively diagnose, fix, reload, re-test and commit any feature that fails (up to N attempts).',
  whenToUse: 'When you want to thoroughly exercise a running application (web UI and/or HTTP API) and automatically repair failing features against the source.',
  phases: [
    { title: 'Discover' },
    { title: 'Test' },
    { title: 'Fix' },
    { title: 'Report' },
  ],
}

// ───────────────────────────── Schemas ─────────────────────────────
// Defined as consts in the body (never inside meta). `surface` is the contract
// between discovery and the test/fix agents — it selects the driver.

const DISCOVERY_SCHEMA = {
  type: 'object',
  required: ['features'],
  properties: {
    features: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'surface', 'kind', 'steps'],
        properties: {
          id: { type: 'string', description: 'stable kebab-case id, unique across the app' },
          name: { type: 'string', description: 'human label, e.g. "Login form submit"' },
          surface: { type: 'string', enum: ['web', 'api'] },
          kind: { type: 'string', description: 'button | form | link | endpoint | flow | toggle' },
          steps: {
            type: 'array',
            description: 'ordered interaction + expectation steps; reused VERBATIM by test and fix agents',
            items: {
              type: 'object',
              required: ['action', 'target'],
              properties: {
                action: { type: 'string', description: 'navigate|click|fill|select|submit|get|post|assert|wait' },
                target: { type: 'string', description: 'web: CSS selector or role+name; api: path like /api/health' },
                value: { type: 'string', description: 'text to fill / JSON body to send' },
                expect: { type: 'string', description: 'what a correct result looks like' },
              },
            },
          },
          sourceHint: { type: 'string', description: 'best guess of the source file/route implementing this feature' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['featureId', 'passed', 'summary'],
  properties: {
    featureId: { type: 'string' },
    passed: { type: 'boolean' },
    summary: { type: 'string' },
    error: { type: 'string', description: 'why it failed; omit/empty if passed' },
    evidence: { type: 'string', description: 'observed reality: DOM snippet, HTTP status, response body excerpt' },
  },
}

const FIX_SCHEMA = {
  type: 'object',
  required: ['featureId', 'attempts', 'fixed', 'retestPassed', 'filesChanged'],
  properties: {
    featureId: { type: 'string' },
    attempts: { type: 'number' },
    fixed: { type: 'boolean', description: 'true only if a source change made the feature pass' },
    retestPassed: { type: 'boolean' },
    diagnosis: { type: 'string', description: 'root cause identified' },
    fix: { type: 'string', description: 'the change made, briefly' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    commitSha: { type: 'string', description: 'git commit sha if a passing change was committed; omit otherwise' },
    reloadNote: { type: 'string', description: 'how the running app was reloaded after editing (or why it could not be)' },
  },
}

const REPORT_SCHEMA = {
  type: 'object',
  required: ['summary'],
  properties: {
    summary: { type: 'string', description: 'a concise markdown report of the whole run' },
  },
}

// ───────────────────────────── Args ─────────────────────────────
// The runtime serializes `args` to a JSON string; the typeof guard handles a
// JSON string, bare text, a live object (future), and undefined.

const input = typeof args === 'string'
  ? (() => { try { return JSON.parse(args) } catch { return args } })()
  : args

const baseUrl = (input && input.baseUrl ? String(input.baseUrl) : '').replace(/\/+$/, '')
const sourcePath = input && input.sourcePath ? String(input.sourcePath) : '.'
const maxFixAttempts = Number.isFinite(input && input.maxFixAttempts) ? input.maxFixAttempts : 3
const maxFeatures = Number.isFinite(input && input.maxFeatures) ? input.maxFeatures : 60
const driverHint = input && input.driver ? String(input.driver) : 'auto' // 'web' | 'api' | 'auto'
const restartCommand = input && input.restartCommand ? String(input.restartCommand) : ''
const doCommit = !(input && input.commit === false) // default true

if (!baseUrl) {
  log('No baseUrl provided. Pass args: { baseUrl: "http://localhost:3000", sourcePath: "." }. Aborting.')
  return { ran: false, error: 'baseUrl is required' }
}

const ctx = JSON.stringify({ baseUrl, sourcePath, driverHint, restartCommand, doCommit, maxFixAttempts })

// ───────────────────────────── 1. Discover ─────────────────────────────
// Independent explorers run in parallel (read-only). The merge/dedup needs ALL
// of them, so a barrier (parallel) is correct here. driverHint can restrict.

phase('Discover')

const explorerTasks = []
if (driverHint !== 'api') {
  explorerTasks.push(() => agent(
    'You are exploring a running app to build a COMPREHENSIVE test manifest of its WEB UI.\n'
    + 'Base URL: ' + baseUrl + '\n'
    + (sourcePath && sourcePath !== '.' ? ('Source root (for implementation hints only): ' + sourcePath + '\n') : '')
    + 'Use the Playwright browser tools (browser_navigate, browser_snapshot, browser_click, browser_type, '
    + 'browser_fill_form, browser_select_option, browser_evaluate, browser_press_key) to crawl the UI from the '
    + 'home page. Enumerate EVERY testable interaction: buttons, links, each form field, toggles, navigation, '
    + 'modals, search/sort/filter, pagination, and short user flows (login, add-to-cart, submit, etc.). For each '
    + 'emit a feature with surface="web", a unique kebab-case id, and concrete ordered `steps` whose final step '
    + 'has an `expect` describing the correct outcome. Be thorough and prefer depth; aim for at least 15 features. '
    + 'Do NOT include bare navigations with no interaction.',
    { label: 'discover:web', phase: 'Discover', schema: DISCOVERY_SCHEMA }))
}
if (driverHint !== 'web') {
  explorerTasks.push(() => agent(
    'You are probing a running app to build a test manifest of its HTTP/REST API surface.\n'
    + 'Base URL: ' + baseUrl + '\n'
    + (sourcePath && sourcePath !== '.' ? ('Source root — scan for route definitions, OpenAPI/Swagger, framework routers: ' + sourcePath + '\n') : '')
    + 'Use curl via Bash to probe common roots (/api, /api/v1, /openapi.json, /swagger.json, /docs, /health). '
    + 'If you have a source root, grep it for route/handler definitions to enumerate REAL endpoints and methods. '
    + 'For each endpoint emit a feature with surface="api"; put the method in the step action '
    + '(get/post/put/delete), the path in target, and an `expect` (status + body shape). '
    + 'If the app has no HTTP API at all, return { features: [] }.',
    { label: 'discover:api', phase: 'Discover', schema: DISCOVERY_SCHEMA }))
}

const discovered = (await parallel(explorerTasks)).filter(Boolean)

// Merge + dedup by id across explorers.
const byId = {}
for (const d of discovered) {
  for (const f of (d && d.features) || []) {
    if (f && f.id && !byId[f.id]) byId[f.id] = f
  }
}
let features = Object.values(byId)
if (features.length > maxFeatures) {
  log(`Manifest capped at ${maxFeatures} of ${features.length} discovered features.`)
  features = features.slice(0, maxFeatures)
}
if (features.length === 0) {
  return { ran: true, discovered: 0, passed: 0, failed: 0, fixed: 0, note: 'No features discovered.' }
}
log(`Discovered ${features.length} features to test.`)

// ───────────────────────────── 2. Test ─────────────────────────────
// One read-only tester per feature, fanned out in parallel. BARRIER: the serial
// Fix phase below needs the complete failure list before it can start.

phase('Test')

const verdicts = (await parallel(features.map(f => () => agent(
  'Execute this feature end-to-end against the running app and decide pass/fail. Be strict but fair: a '
  + 'feature fails ONLY if it genuinely does not behave as `expect`ed. Follow `steps` exactly.\n\n'
  + 'Base URL: ' + baseUrl + '\n'
  + 'Driver: ' + (f.surface === 'web'
      ? 'Playwright browser tools (browser_navigate/snapshot/click/type/fill_form/evaluate). Resolve targets relative to the base URL.'
      : 'curl via Bash against (baseUrl + target). Read HTTP status + body.')
  + '\n\nFeature:\n' + JSON.stringify(f, null, 2)
  + '\n\nCapture concrete evidence in `evidence` (selector/text observed, status code, body excerpt). If it '
  + 'fails, explain precisely WHY in `error` — the fix agent depends on that. Do not attempt any fix.',
  { label: `test:${f.id}`, phase: 'Test', schema: VERDICT_SCHEMA })
))).filter(Boolean)

const results = features.map((f, i) => {
  const v = verdicts[i]
  return v
    ? { feature: f, verdict: v }
    : { feature: f, verdict: { featureId: f.id, passed: false, summary: 'tester returned no verdict', error: 'no verdict returned' } }
})

const passed = results.filter(r => r.verdict.passed)
const failures = results.filter(r => !r.verdict.passed)
log(`Tested ${results.length}: ${passed.length} passed, ${failures.length} failed.`)

// ───────────────────────────── 3. Fix ─────────────────────────────
// SERIAL over failures: one fix agent at a time, because they edit shared source
// and commit. Each failure gets up to maxFixAttempts attempts; an attempt edits,
// reloads the running app, re-tests, and (on green) commits.

phase('Fix')

const fixes = []
if (failures.length === 0) {
  log('All features passed — nothing to fix.')
} else if (sourcePath === '.' && !(input && input.sourcePath)) {
  // sourcePath defaulted (not explicitly provided): still try, but warn.
  log('Failures present. sourcePath defaulted to "."; fix agents will search from the project root.')
}

for (const { feature, verdict } of failures) {
  let attempt = 0
  let retestPassed = false
  let lastFix = null

  while (attempt < maxFixAttempts && !retestPassed) {
    attempt++
    const fix = await agent(
      'A feature of a running app is failing. Find the root cause in the SOURCE, apply a minimal fix, RELOAD '
      + 'the running app so the change takes effect, then RE-RUN the exact feature steps to confirm it passes.\n\n'
      + 'Run context: ' + ctx + '\n'
      + 'Feature:\n' + JSON.stringify(feature, null, 2) + '\n'
      + 'Failure (attempt ' + attempt + '/' + maxFixAttempts + '): '
      + JSON.stringify({ summary: verdict.summary, error: verdict.error, evidence: verdict.evidence }) + '\n'
      + 'Source root: ' + sourcePath + '\n'
      + (lastFix && lastFix.fix ? ('PREVIOUS attempt already tried: "' + lastFix.fix + '". Try a DIFFERENT root cause this time.\n') : '')
      + 'Do these steps in order:\n'
      + ' 1. Read the relevant source (use sourceHint; grep for route/handler/component names). Find the REAL root cause.\n'
      + ' 2. Edit the source — a minimal, surgical change. Do not rewrite unrelated code.\n'
      + ' 3. Reload the running app so the live instance reflects your edit. '
      + (restartCommand
          ? ('Run exactly: `' + restartCommand + '`.')
          : ('Infer it: if a dev server with HMR is running it may hot-reload automatically; otherwise '
             + 'rebuild/restart via the project scripts (package.json scripts, docker compose, Makefile). If you '
             + 'genuinely cannot reload, say so in reloadNote and still attempt the retest.'))
      + '\n 4. Re-run the feature steps EXACTLY as written, using the ' + feature.surface + ' driver against baseUrl ' + baseUrl + '.\n'
      + ' 5. Set retestPassed honestly. If it passes and commit is enabled, stage the changed files and commit: '
      + 'git commit -m "fix(e2e): ' + feature.id + ' — <short reason>". Put the sha in commitSha.'
      + (doCommit ? '' : '  (commit is DISABLED for this run — do NOT commit.)')
      + '\n\nReturn { diagnosis, fix, filesChanged, retestPassed, commitSha?, reloadNote }.',
      { label: `fix:${feature.id}#${attempt}`, phase: 'Fix', schema: FIX_SCHEMA })
    lastFix = fix
    retestPassed = !!(fix && fix.retestPassed)
    if (retestPassed) break
  }

  fixes.push({ feature, verdict, attempts: attempt, fixed: retestPassed, retestPassed, fix: lastFix })
  log(`${retestPassed ? '✓ fixed' : '✗ still failing'}: ${feature.id} (${attempt} attempt${attempt === 1 ? '' : 's'})`)
}

// ───────────────────────────── 4. Report ─────────────────────────────

phase('Report')

const fixedCount = fixes.filter(x => x.fixed).length
const reportInput = JSON.stringify({
  baseUrl,
  discovered: features.length,
  passed: passed.length,
  failed: failures.length,
  fixed: fixedCount,
  unfixed: fixes.filter(x => !x.fixed).map(x => ({ id: x.feature.id, attempts: x.attempts, error: x.verdict.error })),
  commits: fixes.filter(x => x.fix && x.fix.commitSha).map(x => ({ id: x.feature.id, sha: x.fix.commitSha })),
}, null, 2)

const report = await agent(
  'Write a concise markdown end-to-end test report from this structured result. Open with a one-line verdict '
  + 'and the counts, then a compact table of failing features and their final status (fixed / still failing '
  + 'with attempt count and the error), then list any commit SHAs. No filler.\n\n' + reportInput,
  { label: 'report', phase: 'Report', schema: REPORT_SCHEMA })

// Aggregate then reference it in a reachable log() before returning — keeps the
// generic TS checker from flagging the return-only const as "never read".
const total = {
  ran: true,
  baseUrl,
  discovered: features.length,
  passed: passed.length,
  failed: failures.length,
  fixed: fixedCount,
  report: report ? report.summary : null,
  fixes,
}
log(`Done: ${total.passed}/${total.discovered} pass · ${total.fixed}/${total.failed} failures fixed.`)
return total

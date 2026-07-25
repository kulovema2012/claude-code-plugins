---
name: create-app-manual
description: Create beginner-friendly, step-by-step manuals for web, desktop, and mobile applications by exploring the authorized app journey, organizing all artifacts in a dedicated per-manual workspace, capturing every meaningful action, annotating screenshots, and publishing DOCX by default or PDF, Markdown, HTML, or another requested format. Use when documenting a landing page, login, onboarding, administration flow, main product feature, or any end-to-end app process; when updating an existing product guide after UI changes; or when producing Thai or multilingual training material with privacy-reviewed screenshots.
---

# Create App Manual

Create an accurate, replayable app guide from the landing page through the agreed end state. Prefer Thai, complete beginners, the platform's main feature, and DOCX unless the user requests otherwise.

## Non-negotiable rules

- Operate only apps and accounts the user authorizes.
- Prefer an existing authenticated admin session. Otherwise request access through an approved secure mechanism; never ask the user to paste credentials into ordinary chat.
- Never place credentials or other sensitive data in the final document, filenames, captions, annotations, metadata, manifests, or status messages.
- Ask for explicit approval immediately before purchases, submissions, sends, deletes, publication, legal acceptance, permission changes, or other consequential actions.
- Capture every meaningful user action. Permit several clearly ordered markers in one screenshot when the actions share the same stable screen.
- Preserve exact UI labels. If the app lacks Thai UI, keep its original labels and explain them in Thai.
- Propose the journey outline and receive user approval before performing the full capture.
- Before any grounded app interaction, ask the user which parent directory should store the manual files and wait for an explicit answer. Do not open, launch, inspect, navigate, or operate the app first.
- Create and verify one dedicated workspace folder inside the user-approved directory before the first grounded app interaction. Keep all manual-specific files inside it unless the user approves another location.
- Keep an unmodified source capture until fidelity review finishes. Do not overwrite it with an annotated version.
- Before sending a screenshot containing visible sensitive data to an image model, warn that prompt-based omission is not guaranteed and obtain explicit consent for that run. Record the consent decision without recording the sensitive value.
- Reject any annotated image that changes UI text, controls, data, layout, state, or branding beyond the requested markers and concealment.
- Report what was directly verified, what was inferred, and what could not be accessed.

## Workflow

### 1. Establish the assignment

Before using any browser, computer-control, emulator, or app tool, collect:

- app name, URL or launch method, and platform;
- the exact user-approved parent directory for all manual files;
- authorized account/session and environment;
- audience, language, output format, branding, and accessibility needs;
- requested start and end points;
- actions that require approval;
- whether screenshots with visible sensitive data may be sent to an image model.

Use these defaults when the user does not decide:

- audience: complete beginners;
- language: Thai;
- format: DOCX;
- scope: landing page, login, onboarding, and the main feature's first successful outcome;
- style: clean, neutral training manual;
- capture density: every meaningful action.

Do not silently choose a storage directory. If the user has not provided one, ask and stop before interacting with the app.

Read [references/workflow.md](references/workflow.md) for platform routing, reconnaissance, capture-state control, and journey selection.

### 2. Create the dedicated workspace

Read [references/workspace-layout.md](references/workspace-layout.md), then run:

```bash
python scripts/init_manual_workspace.py "<app-name>" \
  --root "<output-root>" \
  --language th \
  --format docx
```

Use the printed workspace path for every later artifact. Do not scatter screenshots, drafts, or exports elsewhere. Replace the generated manifest placeholders as the journey becomes known; never put credential values in any workspace file.

Verify that the printed workspace exists and contains `captures/`, `assets/`, `documents/`, `working/manifest.json`, `temp/`, and `exports/`. Do not continue to app reconnaissance if creation or verification fails.

### 3. Reconnoiter and propose the journey

Use Playwright or an equivalent browser-control capability for web apps in most cases. Use available computer-control or emulator capabilities for desktop and mobile apps. If direct control is unavailable, request user-supplied screenshots and verified step details.

Inspect only enough of the landing page, navigation, and authorized area to identify the main feature. Draft a numbered journey with:

- start state;
- login and onboarding states;
- main feature;
- success state;
- consequential actions requiring approval;
- known access limitations.

Wait for the user's approval before full capture. Resolve unclear branches rather than silently choosing.

### 4. Build the capture manifest

Update `working/manifest.json` using [references/manifest-schema.md](references/manifest-schema.md). Use it as the source of truth for steps, screenshots, markers, verification, consent, and expected results. Never store secret values in it.

Run:

```bash
python scripts/validate_guide_manifest.py "<workspace>/working/manifest.json"
```

Fix validation failures before authoring the final guide.

### 5. Execute and capture

Start from a reproducible state. Record the actual platform, viewport/device, app version when visible, account role without identity, language, and capture date.

For every meaningful action:

1. Capture the stable state immediately before or after the action, whichever best teaches it.
2. Record the exact UI label and user action.
3. Record the expected visible result.
4. Assign ordered marker numbers.
5. Note branches, loading states, validation messages, and recovery steps.
6. Verify the step by replay or direct observation.

Do not expose credentials while explaining login. Exclude unrelated personal, customer, financial, security, and notification data from the final output.

### 6. Annotate screenshots

Read [references/annotation-and-privacy.md](references/annotation-and-privacy.md) before processing screenshots.

Prefer the available `chatgpt-image-2` image-editing capability when the user requested AI annotations. Give the model the preservation prompt from that reference. Add only ordered markers, arrows, boxes, and short callouts. Several markers may share one screenshot when their sequence is unambiguous.

If image editing is unavailable or changes the UI, use deterministic overlays or another lossless annotation method. Compare each result with its source and verify text, controls, layout, state, marker order, and sensitive-data handling.

### 7. Author the manual

Read [references/manual-format.md](references/manual-format.md). Use the installed document-creation capability for DOCX and follow its instructions. Produce another format when requested.

For Thai output:

- write natural, beginner-friendly Thai;
- keep exact UI labels in the app's displayed language;
- add a Thai explanation after non-Thai labels when useful;
- use a Thai-capable font and verify glyph rendering;
- use consistent Thai terminology across the guide.

Place each screenshot beside the steps it supports. Explain marker numbers in the same order they appear. Include prerequisites, privacy guidance, expected outcomes, troubleshooting, and a completion checklist.

### 8. Quality gate and delivery

Verify:

- the approved journey and end state are covered;
- every meaningful action has screenshot evidence;
- screenshot markers and instructions match;
- no credentials or sensitive values appear anywhere in the deliverable;
- no annotation changed the underlying UI;
- Thai text and UI labels render correctly;
- links, headings, numbering, captions, and table of contents work;
- a beginner can replay the process without unstated knowledge;
- inaccessible or inferred steps are labeled honestly.

Validate the final manifest again. Open and visually inspect the produced document, not only its source representation. Save final manuals in `exports/` and retained guide images in `captures/annotated/`. Deliver the workspace path, requested file path, and a concise verification summary. Clean up `temp/` and sensitive source captures after successful verification and report what was removed.

## Resources

- [references/workflow.md](references/workflow.md): platform routing, scope selection, and capture procedure.
- [references/workspace-layout.md](references/workspace-layout.md): dedicated per-manual folder structure, naming, and retention.
- [references/annotation-and-privacy.md](references/annotation-and-privacy.md): consent gate, preservation prompt, annotation grammar, and fidelity review.
- [references/manual-format.md](references/manual-format.md): Thai-first DOCX structure and final QA.
- [references/manifest-schema.md](references/manifest-schema.md): working manifest format and example.
- `scripts/init_manual_workspace.py`: deterministic workspace and starter-manifest initializer.
- `scripts/validate_guide_manifest.py`: deterministic coverage and safety-field validator.

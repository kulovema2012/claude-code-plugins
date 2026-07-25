# Dedicated manual workspace

Before opening, launching, inspecting, navigating, or operating the app:

1. ask the user for the exact parent directory that should store the manual;
2. wait for the user's answer;
3. resolve ambiguous or relative locations and confirm the intended path when necessary;
4. create and verify the dedicated workspace inside that directory;
5. begin grounded app interaction only after verification succeeds.

Never infer or silently default the parent directory. Never reuse or overwrite an existing manual workspace.

Create the workspace as:

```text
<user-approved-parent>/<app-slug>-manual-<YYYYMMDD-HHMMSS>/
```

## Folder layout

```text
<manual-workspace>/
  assets/
    branding/             # User-provided logos, fonts, and approved visual assets
    reference/            # User-provided non-secret examples and source material
  captures/
    source/               # Original temporary screenshots used for fidelity review
    sanitized/            # Locally privacy-treated copies when required
    annotated/            # Privacy-reviewed screenshots retained with the guide
  documents/
    drafts/               # Editable document drafts and intermediate renders
  exports/                # Final DOCX, PDF, HTML, or other requested deliverables
  temp/                   # Disposable OCR, diff, rendering, and conversion artifacts
  working/
    manifest.json         # Journey, screenshot, consent, and verification source of truth
  .gitignore              # Guards sensitive source and temporary material
```

## Creation

Run from the directory containing `SKILL.md`, or use an absolute script path:

```bash
python scripts/init_manual_workspace.py "Sample App" \
  --root "C:\User Chosen Directory"
```

Language and output-format arguments are optional:

```bash
python scripts/init_manual_workspace.py "Sample App" \
  --root "C:\Manual Projects" \
  --language th \
  --format docx
```

The initializer prints the absolute workspace path. Use that path for all subsequent captures, drafts, manifests, and exports.

Verify the printed path and all required subdirectories before interacting with the app. If initialization fails, report the error and remain blocked from app interaction until the workspace is ready.

## Storage rules

- Store every manual-specific artifact inside the workspace.
- Use neutral filenames such as `step-03-open-settings-source.png`; never include names, emails, account IDs, tokens, or other sensitive values.
- Keep source and annotated screenshots separate.
- Copy only approved brand assets into `assets/branding/`.
- Copy non-secret examples and source material into `assets/reference/`.
- Keep intermediate document files in `documents/drafts/`.
- Put only completed deliverables in `exports/`.
- Never store credentials, session cookies, browser profiles, authentication state, recovery codes, or secret configuration in the workspace.
- Do not initialize a Git repository automatically.
- Respect the generated `.gitignore`; source screenshots and temporary artifacts may contain sensitive material.

## Retention and cleanup

Retain final exports and privacy-reviewed annotated images. After final verification:

1. remove disposable files from `temp/`;
2. remove sensitive source captures from `captures/source/`;
3. keep non-sensitive source captures only when the user requests them;
4. report what was removed and what remains;
5. never delete the entire workspace unless the user explicitly requests it.

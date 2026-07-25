# App exploration and capture workflow

## Contents

1. Platform routing
2. Authorization and access
3. Reconnaissance
4. Journey selection
5. Capture-state control
6. Meaningful-action rule
7. Consequential actions
8. Blocked and hybrid workflows

## Platform routing

Choose the narrowest reliable control surface:

| Platform | Preferred control | Fallback |
| --- | --- | --- |
| Web or PWA | Playwright or equivalent browser automation | Interactive browser control, then user-supplied captures |
| Desktop app | Available computer-control capability | App-native export, then user-supplied captures |
| Android/iOS | Emulator or connected-device control | Browser device emulation for web-only behavior, then user-supplied captures |
| Mixed journey | Use the proper control per segment | Combine verified captures and label platform transitions |

Do not represent browser device emulation as proof of native-app behavior.

## Authorization and access

Confirm the user authorizes the app, environment, account role, and journey. Prefer an existing authenticated admin session. If it is unavailable, request access through an approved secure mechanism. Never request or repeat credentials in normal chat, store them in notes or manifests, or expose them in outputs.

Describe the role as `admin`, `member`, or another non-identifying label. Do not record the account identity.

## Reconnaissance

Inspect the public landing page, primary navigation, login boundary, onboarding entry, and authorized navigation. Determine the main feature from:

1. primary navigation and dominant calls to action;
2. product positioning on the landing page;
3. first-run onboarding;
4. the most central create-to-success workflow;
5. user-provided priorities.

When signals disagree, present the likely journey and alternatives to the user. Do not begin the full capture until the user approves an outline.

## Journey selection

Default to:

1. introduce the landing page;
2. open login;
3. authenticate without revealing values;
4. complete or explain onboarding;
5. reach the main workspace;
6. perform the main feature;
7. show the first successful outcome;
8. provide recovery and completion checks.

Allow a user-defined start, end, or feature list. For broad requests such as "document everything," split the app into independently reviewable journeys and agree on an order.

## Capture-state control

Use a reproducible test or admin environment when possible. Record:

- platform and app surface;
- browser/device and viewport;
- UI language;
- account role;
- visible app version or release identifier;
- date of observation;
- seed data or prerequisite state without sensitive values.

Before each capture, close irrelevant notifications, stabilize animations, wait for loading to finish, and place the focus/pointer where it does not hide the target. Keep filenames neutral, ordered, and free of user or secret data, such as `step-04-create-project-source.png`.

Preserve source and annotated files separately inside the dedicated workspace:

```text
captures/
  source/
  annotated/
```

Treat `source/` as temporary working material. Never overwrite it.

## Meaningful-action rule

Capture an action when it changes state, navigation, understanding, or the user's ability to continue. Examples include:

- selecting a navigation item;
- entering a required field;
- choosing an option that affects later behavior;
- submitting or saving;
- responding to validation;
- granting a permission;
- confirming a success state.

Do not create redundant screenshots for cursor movement, scrolling that reveals nothing new, or repeated fields with identical behavior. Combine several actions in one image only when:

- all targets are visible on the same stable screen;
- markers make the order unmistakable;
- no intermediate state teaches something important;
- the caption explains each marker in order.

## Consequential actions

Pause immediately before:

- purchases, billing changes, or financial transfers;
- sending messages, invitations, or notifications;
- publishing or sharing;
- final form submission;
- deletion or irreversible modification;
- permission, role, or security changes;
- acceptance of legal terms;
- any action that affects real users or production data.

State the exact action and impact, then obtain explicit approval. A journey-outline approval does not replace this just-in-time approval.

## Blocked and hybrid workflows

If direct control is unavailable, ask the user for screenshots or a screen recording and the exact observed results. Build the same manifest and mark evidence as `user_supplied`. Do not invent inaccessible states.

For partial access, combine direct and supplied evidence. Mark each step as:

- `direct`: observed and operated;
- `user_supplied`: supplied by the user;
- `inferred`: deduced but not verified;
- `blocked`: inaccessible.

Keep inferred steps out of procedural claims unless the user accepts them explicitly.

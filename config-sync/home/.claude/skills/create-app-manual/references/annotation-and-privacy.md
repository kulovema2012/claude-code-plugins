# Screenshot annotation and privacy

## Contents

1. Source preservation
2. Sensitive-image consent gate
3. Image-model preservation prompt
4. Annotation grammar
5. Fidelity review
6. Fallback behavior

## Source preservation

Keep the original capture unchanged until the annotated image and final document pass review. Work on a copy. Never annotate a screenshot by recreating the interface from memory.

## Sensitive-image consent gate

Before sending any screenshot with visible sensitive data to an image model:

1. Identify the types of visible data without repeating their values.
2. Warn the user that prompt-based omission is not guaranteed and that the model will receive the image.
3. Ask for explicit consent for the current run.
4. Record only `consent_obtained: true` and the consent time in the manifest.
5. If consent is denied, redact locally or use deterministic overlays without sending the sensitive image.

Consent never permits credentials or sensitive data to appear in the final manual.

Treat the following as sensitive unless the user explicitly defines a stricter policy:

- usernames, emails, passwords, passcodes, recovery codes, and tokens;
- names, faces, addresses, phone numbers, account IDs, and customer records;
- financial, health, legal, employment, and private business information;
- private notifications, messages, URLs, QR codes, and browser autofill suggestions;
- secrets visible in filenames, tabs, developer tools, or system chrome.

## Image-model preservation prompt

Adapt this prompt without weakening its preservation constraints:

```text
Edit this screenshot only by adding the requested instructional overlays.

Preserve the input screenshot exactly: do not redraw, restyle, translate, sharpen,
reflow, crop, resize, replace, invent, or remove any UI text, icon, control, image,
spacing, color, state, cursor, browser chrome, or branding.

Add only these overlays: [NUMBERED MARKERS / ARROWS / BOXES / SHORT CALLOUTS].
Place them at: [EXACT TARGETS AND ORDER].

Omit and conceal these sensitive data categories from the edited output:
[CATEGORIES ONLY; NEVER REPEAT VALUES IN THE PROMPT].

Keep overlays outside important text where possible. Use high-contrast markers with
a white keyline and do not use color alone to communicate meaning. Return one edited
image with the same dimensions and aspect ratio as the input.
```

Prompting does not prove omission or preservation. Always perform the fidelity review.

## Annotation grammar

Use:

- numbered circles for ordered actions;
- arrows for direction or movement;
- rectangular outlines for target regions;
- short callouts only when a number and caption cannot explain the target;
- a consistent accent color with a contrasting outline;
- marker sizes readable at the document's final display size.

Allow several markers in one screenshot. Number them in reading order and explain them in the same order below or beside the image. Avoid covering exact labels, validation text, or outcomes.

## Fidelity review

Compare source and annotated copies at full resolution. Verify:

- identical dimensions and aspect ratio;
- unchanged UI wording, language, numbers, icons, and branding;
- unchanged controls, selection state, layout, and background;
- correct marker targets and order;
- no new synthetic UI elements;
- no sensitive values in pixels, captions, alt text, or metadata.

Use OCR or pixel-difference tooling when available, followed by visual inspection. Reject and regenerate or use deterministic overlays if any unsupported change appears.

## Fallback behavior

When image editing is unavailable, fails, or changes the interface, add overlays with a deterministic image or document-editing tool. Preserve the original pixels, dimensions, and aspect ratio. Record `ai_used: false` and the fallback method in the manifest.

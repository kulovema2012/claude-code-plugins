# Capture manifest schema

Use a JSON manifest as the internal source of truth. Do not include credential values or other sensitive content.

## Required shape

```json
{
  "title": "คู่มือการใช้งาน Sample App",
  "app_name": "Sample App",
  "platform": "web",
  "language": "th",
  "audience": "complete beginners",
  "output_format": "docx",
  "scope": {
    "start": "landing page",
    "end": "first successful core task",
    "journey_approved": true
  },
  "security": {
    "authorized": true,
    "account_role": "admin",
    "credentials_excluded_from_output": true,
    "image_model_sensitive_input": false,
    "image_model_consent_obtained": false,
    "image_model_consent_at": null
  },
  "steps": [
    {
      "id": "step-01",
      "title": "เปิดหน้าเข้าสู่ระบบ",
      "action": "Select the displayed Login control",
      "expected_result": "The login form is visible",
      "evidence": "direct",
      "meaningful": true,
      "consequential": false,
      "approval_obtained": false,
      "screenshot": {
        "source": "captures/source/step-01.png",
        "annotated": "captures/annotated/step-01.png",
        "markers": [1],
        "ai_used": true,
        "fidelity_verified": true,
        "sensitive_data_reviewed": true
      }
    }
  ]
}
```

## Field rules

- Set `platform` to `web`, `desktop`, `android`, `ios`, or `mixed`.
- Set `language` to the document language; use `th` by default.
- Set `scope.journey_approved` only after the user accepts the proposed journey.
- Keep `security.account_role` non-identifying.
- Set `image_model_sensitive_input` when visible sensitive pixels are sent to an image model.
- Require `image_model_consent_obtained` and an ISO 8601 `image_model_consent_at` timestamp when `image_model_sensitive_input` is true.
- Set `evidence` to `direct`, `user_supplied`, `inferred`, or `blocked`.
- Give every meaningful step a source image, annotated image, one or more ordered markers, and completed fidelity and sensitive-data reviews.
- Set `approval_obtained` for consequential steps only after just-in-time approval.
- Use neutral screenshot paths without names, emails, IDs, or secrets.

The manifest is a quality-control artifact, not necessarily part of the final manual. Deliver it only when the user requests it.

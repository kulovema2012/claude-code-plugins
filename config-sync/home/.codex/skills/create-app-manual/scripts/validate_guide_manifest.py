#!/usr/bin/env python3
"""Validate an app-manual capture manifest using only the Python standard library."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


ALLOWED_PLATFORMS = {"web", "desktop", "android", "ios", "mixed"}
ALLOWED_EVIDENCE = {"direct", "user_supplied", "inferred", "blocked"}
SENSITIVE_PATH_PATTERN = re.compile(
    r"(password|passwd|secret|token|api[-_]?key|credential|@)",
    re.IGNORECASE,
)


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_manifest(data: Any) -> list[str]:
    errors: list[str] = []
    require(isinstance(data, dict), "root: must be a JSON object", errors)
    if not isinstance(data, dict):
        return errors

    for field in (
        "title",
        "app_name",
        "platform",
        "language",
        "audience",
        "output_format",
    ):
        require(nonempty_string(data.get(field)), f"{field}: required non-empty string", errors)

    require(
        data.get("platform") in ALLOWED_PLATFORMS,
        f"platform: use one of {sorted(ALLOWED_PLATFORMS)}",
        errors,
    )

    scope = data.get("scope")
    require(isinstance(scope, dict), "scope: required object", errors)
    if isinstance(scope, dict):
        require(nonempty_string(scope.get("start")), "scope.start: required", errors)
        require(nonempty_string(scope.get("end")), "scope.end: required", errors)
        require(
            scope.get("journey_approved") is True,
            "scope.journey_approved: must be true before full production",
            errors,
        )

    security = data.get("security")
    require(isinstance(security, dict), "security: required object", errors)
    if isinstance(security, dict):
        require(security.get("authorized") is True, "security.authorized: must be true", errors)
        require(
            nonempty_string(security.get("account_role")),
            "security.account_role: required non-identifying role",
            errors,
        )
        require(
            security.get("credentials_excluded_from_output") is True,
            "security.credentials_excluded_from_output: must be true",
            errors,
        )
        if security.get("image_model_sensitive_input") is True:
            require(
                security.get("image_model_consent_obtained") is True,
                "security.image_model_consent_obtained: required for sensitive image-model input",
                errors,
            )
            require(
                nonempty_string(security.get("image_model_consent_at")),
                "security.image_model_consent_at: required for sensitive image-model input",
                errors,
            )

    steps = data.get("steps")
    require(isinstance(steps, list) and bool(steps), "steps: required non-empty array", errors)
    if not isinstance(steps, list):
        return errors

    seen_ids: set[str] = set()
    for index, step in enumerate(steps, start=1):
        prefix = f"steps[{index - 1}]"
        require(isinstance(step, dict), f"{prefix}: must be an object", errors)
        if not isinstance(step, dict):
            continue

        step_id = step.get("id")
        require(nonempty_string(step_id), f"{prefix}.id: required", errors)
        if nonempty_string(step_id):
            require(step_id not in seen_ids, f"{prefix}.id: duplicate {step_id!r}", errors)
            seen_ids.add(step_id)

        for field in ("title", "action", "expected_result"):
            require(nonempty_string(step.get(field)), f"{prefix}.{field}: required", errors)

        require(
            step.get("evidence") in ALLOWED_EVIDENCE,
            f"{prefix}.evidence: use one of {sorted(ALLOWED_EVIDENCE)}",
            errors,
        )

        if step.get("consequential") is True:
            require(
                step.get("approval_obtained") is True,
                f"{prefix}.approval_obtained: required for consequential action",
                errors,
            )

        if step.get("meaningful") is True:
            screenshot = step.get("screenshot")
            require(isinstance(screenshot, dict), f"{prefix}.screenshot: required", errors)
            if not isinstance(screenshot, dict):
                continue

            for field in ("source", "annotated"):
                path_value = screenshot.get(field)
                require(nonempty_string(path_value), f"{prefix}.screenshot.{field}: required", errors)
                if nonempty_string(path_value):
                    require(
                        not SENSITIVE_PATH_PATTERN.search(path_value),
                        f"{prefix}.screenshot.{field}: path appears to contain sensitive wording",
                        errors,
                    )

            markers = screenshot.get("markers")
            valid_markers = (
                isinstance(markers, list)
                and bool(markers)
                and all(isinstance(marker, int) and marker > 0 for marker in markers)
                and markers == sorted(set(markers))
            )
            require(
                valid_markers,
                f"{prefix}.screenshot.markers: require unique positive integers in order",
                errors,
            )
            require(
                screenshot.get("fidelity_verified") is True,
                f"{prefix}.screenshot.fidelity_verified: must be true",
                errors,
            )
            require(
                screenshot.get("sensitive_data_reviewed") is True,
                f"{prefix}.screenshot.sensitive_data_reviewed: must be true",
                errors,
            )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="Path to capture manifest JSON")
    args = parser.parse_args()

    try:
        data = json.loads(args.manifest.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"ERROR: manifest not found: {args.manifest}", file=sys.stderr)
        return 2
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read manifest: {exc}", file=sys.stderr)
        return 2

    errors = validate_manifest(data)
    if errors:
        print(f"INVALID: {len(errors)} issue(s)")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"VALID: {len(data['steps'])} step(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

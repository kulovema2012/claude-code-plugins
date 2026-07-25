#!/usr/bin/env python3
"""Create a dedicated workspace for one app-manual production run."""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path


WORKSPACE_DIRS = (
    "assets/branding",
    "assets/reference",
    "captures/source",
    "captures/sanitized",
    "captures/annotated",
    "documents/drafts",
    "exports",
    "temp",
    "working",
)


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).strip().lower()
    characters: list[str] = []
    previous_dash = False
    for character in normalized:
        if character.isalnum():
            characters.append(character)
            previous_dash = False
        elif not previous_dash:
            characters.append("-")
            previous_dash = True
    slug = "".join(characters).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return (slug or "app")[:60].rstrip("-")


def unique_workspace(root: Path, base_name: str) -> Path:
    candidate = root / base_name
    suffix = 2
    while candidate.exists():
        candidate = root / f"{base_name}-{suffix}"
        suffix += 1
    return candidate


def starter_manifest(
    app_name: str,
    language: str,
    output_format: str,
    created_at: str,
) -> dict[str, object]:
    return {
        "title": f"Manual for {app_name}",
        "app_name": app_name,
        "platform": "",
        "language": language,
        "audience": "complete beginners",
        "output_format": output_format,
        "created_at": created_at,
        "scope": {
            "start": "",
            "end": "",
            "journey_approved": False,
        },
        "security": {
            "authorized": False,
            "account_role": "",
            "credentials_excluded_from_output": True,
            "image_model_sensitive_input": False,
            "image_model_consent_obtained": False,
            "image_model_consent_at": None,
        },
        "steps": [],
    }


def create_workspace(
    app_name: str,
    root: Path,
    language: str,
    output_format: str,
    now: datetime | None = None,
) -> Path:
    current_time = now or datetime.now().astimezone()
    timestamp = current_time.strftime("%Y%m%d-%H%M%S")
    workspace_name = f"{slugify(app_name)}-manual-{timestamp}"
    resolved_root = root.expanduser().resolve()
    resolved_root.mkdir(parents=True, exist_ok=True)
    workspace = unique_workspace(resolved_root, workspace_name)
    workspace.mkdir()

    for relative_dir in WORKSPACE_DIRS:
        (workspace / relative_dir).mkdir(parents=True)

    manifest = starter_manifest(
        app_name,
        language,
        output_format,
        current_time.isoformat(timespec="seconds"),
    )
    (workspace / "working" / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    (workspace / ".gitignore").write_text(
        "\n".join(
            (
                "# Sensitive or disposable manual-production material",
                "captures/source/*",
                "temp/*",
                "*.tmp",
                "~$*",
                "",
            )
        ),
        encoding="utf-8",
    )

    return workspace


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("app_name", help="Human-readable application name")
    parser.add_argument(
        "--root",
        type=Path,
        required=True,
        help="User-approved parent output directory (required)",
    )
    parser.add_argument("--language", default="th", help="Guide language (default: th)")
    parser.add_argument("--format", default="docx", dest="output_format", help="Output format")
    args = parser.parse_args()

    workspace = create_workspace(
        app_name=args.app_name,
        root=args.root,
        language=args.language,
        output_format=args.output_format,
    )
    print(workspace)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""One version for the whole unit: the page's package.json, read at build time.

The image copies package.json next to this package, so the server reports
the version of the commit it was built from, and the commit itself comes from
Cloud Build as FB13_COMMIT (its first seven characters, as the page shows).
In a checkout the file sits two directories up. Nothing is invented: if the
file is missing the version says so.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

UNIT = "FB13"
SERVICE_NAME = "fb13-trade-slip-api"


def _package_version() -> str:
    here = Path(__file__).resolve()
    for candidate in (here.parents[1] / "package.json", here.parents[2] / "package.json"):
        if candidate.is_file():
            try:
                return str(json.loads(candidate.read_text("utf-8")).get("version") or "unknown")
            except (OSError, ValueError):
                return "unreadable"
    return "unknown"


VERSION = _package_version()
COMMIT = os.environ.get("FB13_COMMIT", "").strip()[:7]


def build_label() -> str:
    return f"version {VERSION}, {f'commit {COMMIT}' if COMMIT else 'no commit hash'}"

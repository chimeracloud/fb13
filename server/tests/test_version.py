import json
import re
from pathlib import Path

from app import version


def test_version_is_the_page_version():
    package = json.loads((Path(__file__).resolve().parents[2] / "package.json").read_text("utf-8"))
    assert version.VERSION == package["version"]
    assert re.fullmatch(r"\d+\.\d+\.\d+", version.VERSION)


def test_commit_is_empty_or_seven_characters():
    assert version.COMMIT == "" or re.fullmatch(r"[0-9a-f]{7}", version.COMMIT)


def test_build_label_in_words():
    assert version.build_label() == f"version {version.VERSION}, no commit hash"

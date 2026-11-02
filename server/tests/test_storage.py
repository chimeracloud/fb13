import json

import pytest

from app import storage
from app.storage import MemoryStore, dumps, name_for, open_store


def test_names_order_by_time_and_end_in_json():
    earlier = name_for("settings/v/", 1_700_000_000_000)
    later = name_for("settings/v/", 1_700_000_000_001)
    assert earlier.startswith("settings/v/1700000000000-")
    assert earlier.endswith(".json")
    assert earlier < later


def test_memory_store_newest_wins():
    store = MemoryStore()
    a = store.put("p/", {"n": 1}, 10)
    b = store.put("p/", {"n": 2}, 20)
    store.put("q/", {"n": 3}, 30)
    assert store.names("p/") == [a, b]
    assert store.latest("p/") == ({"n": 2}, b)
    assert store.newest("p/", 5) == [(b, {"n": 2}), (a, {"n": 1})]
    assert store.newest("p/", 1) == [(b, {"n": 2})]
    assert store.latest("none/") == (None, None)
    assert store.reachable() is True


def test_memory_store_is_create_only(monkeypatch):
    store = MemoryStore()
    monkeypatch.setattr(storage, "name_for", lambda prefix, t_ms=None: f"{prefix}fixed.json")
    assert store.put("p/", {"n": 1}) == "p/fixed.json"
    with pytest.raises(FileExistsError):
        store.put("p/", {"n": 2})
    assert store.get("p/fixed.json") == {"n": 1}


def test_dumps_is_compact_sorted_utf8():
    raw = dumps({"b": "£", "a": 1})
    assert raw == '{"a":1,"b":"£"}'.encode("utf-8")
    assert json.loads(raw) == {"a": 1, "b": "£"}


def test_open_store_without_a_bucket_is_memory():
    assert open_store(None).kind == "memory"
    assert open_store("").kind == "memory"
    gcs = open_store("chiops-fb13-config")
    assert gcs.kind == "gcs" and gcs.location == "gs://chiops-fb13-config"

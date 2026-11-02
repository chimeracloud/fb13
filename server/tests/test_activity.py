from datetime import datetime, timezone

from app.activity import PREFIX, Activity
from app.storage import MemoryStore


def test_record_stores_and_remembers_newest_first():
    store = MemoryStore()
    a = Activity(store)
    first = a.record("kill", "cloud@ascotwm.com", reason="stop")
    second = a.record("resume", "cloud@ascotwm.com")
    assert first["stored_as"].startswith(f"{PREFIX}{first['at'][:10]}/")
    assert store.get(first["stored_as"])["detail"] == {"reason": "stop"}
    assert [e["event"] for e in a.recent()] == ["resume", "kill"]
    assert a.recorded == 2 and a.store_errors == 0
    assert second["by"] == "cloud@ascotwm.com"


def test_store_failure_never_stops_the_event():
    class Broken(MemoryStore):
        def put(self, prefix, data, t_ms=None):
            raise PermissionError("403")

    a = Activity(Broken())
    ev = a.record("kill", "x@y.z")
    assert ev["stored_as"] is None
    assert a.store_errors == 1 and "403" in a.last_store_error
    assert a.recent()[0]["event"] == "kill"


def test_load_recent_reads_today_and_yesterday_oldest_first():
    store = MemoryStore()
    today = datetime.now(timezone.utc).date().isoformat()
    store.put(f"{PREFIX}{today}/", {"id": "1", "at": f"{today}T01:00:00.000Z", "event": "one", "by": None, "detail": {}}, 1)
    store.put(f"{PREFIX}{today}/", {"id": "2", "at": f"{today}T02:00:00.000Z", "event": "two", "by": None, "detail": {}}, 2)
    store.put(f"{PREFIX}2000-01-01/", {"id": "0", "event": "ancient"}, 0)
    a = Activity(store)
    own = a.record("instance_start")
    assert a.load_recent(50) == 2
    assert [e["event"] for e in a.recent()] == ["instance_start", "two", "one"]
    assert a.recent()[0] is not None and own["id"] == a.recent()[0]["id"]

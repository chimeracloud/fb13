import pytest

from app.settings import DEFAULTS, PREFIX, Settings, SettingsError, check_caps, check_operators, normalise
from app.storage import MemoryStore


def make(ttl_s=5.0):
    store = MemoryStore()
    return store, Settings(store, ttl_s=ttl_s)


def test_defaults_are_the_safe_side():
    assert DEFAULTS["mode"] == "paper"
    assert DEFAULTS["placing_enabled"] is False
    assert DEFAULTS["page_access_confirmed"] is False
    assert DEFAULTS["caps"] == {"per_order_at_risk_gbp": 5.0, "per_day_at_risk_gbp": 10.0}
    assert DEFAULTS["operators"] == []


def test_nothing_stored_means_defaults_and_says_so():
    store, s = make()
    view = s.load()
    assert view["values"] == DEFAULTS
    assert view["in_force_from"] is None
    assert view["versions"] == 0
    assert view["error"] is None
    assert s.real_allowed is False


def test_the_stored_value_governs_not_the_code_default():
    store, s = make()
    store.put(PREFIX, {"values": {"mode": "real", "page_access_confirmed": True, "placing_enabled": True,
                                  "caps": {"per_order_at_risk_gbp": 2.0, "per_day_at_risk_gbp": 6.0},
                                  "operators": ["Cloud@ascotwm.com"]},
                       "updated_at": "2026-11-02T10:00:00.000Z", "updated_by": "charles", "reason": "test"}, 100)
    view = s.load()
    v = view["values"]
    assert v["mode"] == "real" and v["placing_enabled"] is True and v["page_access_confirmed"] is True
    assert v["caps"] == {"per_order_at_risk_gbp": 2.0, "per_day_at_risk_gbp": 6.0}
    assert v["operators"] == ["cloud@ascotwm.com"]
    assert view["updated_by"] == "charles" and view["reason"] == "test"
    assert s.real_allowed is True


def test_newest_version_wins():
    store, s = make()
    store.put(PREFIX, {"values": {"placing_enabled": True}}, 100)
    store.put(PREFIX, {"values": {"placing_enabled": False}}, 200)
    assert s.load()["values"]["placing_enabled"] is False
    assert s.versions == 2


def test_bad_stored_values_fall_to_the_safe_side_and_are_reported():
    store, s = make()
    store.put(PREFIX, {"values": {"mode": "live", "placing_enabled": "yes",
                                  "caps": {"per_order_at_risk_gbp": 50, "per_day_at_risk_gbp": 10},
                                  "operators": ["not an email"]}}, 100)
    view = s.load()
    assert view["values"]["mode"] == "paper"
    assert view["values"]["placing_enabled"] is False
    assert view["values"]["caps"] == DEFAULTS["caps"]
    assert view["values"]["operators"] == []
    assert len(view["problems"]) == 4
    assert any("nobody can sign in" in p for p in view["problems"])


def test_normalise_accepts_a_bare_values_object_too():
    values, problems = normalise({"mode": "real"})
    assert values["mode"] == "real" and problems == []


def test_caps_validation():
    assert check_caps({"per_order_at_risk_gbp": 5, "per_day_at_risk_gbp": 10}) == {"per_order_at_risk_gbp": 5.0, "per_day_at_risk_gbp": 10.0}
    for bad, words in [
        ({"per_order_at_risk_gbp": 5}, "required"),
        ({"per_order_at_risk_gbp": 0, "per_day_at_risk_gbp": 10}, "more than 0"),
        ({"per_order_at_risk_gbp": 5.001, "per_day_at_risk_gbp": 10}, "whole pence"),
        ({"per_order_at_risk_gbp": 12, "per_day_at_risk_gbp": 10}, "day cap cannot be below"),
        ({"per_order_at_risk_gbp": "5", "per_day_at_risk_gbp": 10}, "number of pounds"),
        ({"per_order_at_risk_gbp": True, "per_day_at_risk_gbp": 10}, "number of pounds"),
        ({"per_order_at_risk_gbp": 5, "per_day_at_risk_gbp": 10, "weekly": 1}, "unknown cap"),
        ([5, 10], "must be an object"),
    ]:
        with pytest.raises(SettingsError, match=words):
            check_caps(bad)


def test_operators_validation():
    assert check_operators([" Cloud@ascotwm.com ", "cloud@ascotwm.com", "a@b.c"]) == ["cloud@ascotwm.com", "a@b.c"]
    with pytest.raises(SettingsError, match="not an email address"):
        check_operators(["charles"])
    with pytest.raises(SettingsError, match="not an email address"):
        check_operators(["@x"])
    with pytest.raises(SettingsError, match="list"):
        check_operators("cloud@ascotwm.com")


def test_put_changes_caps_and_operators_only_and_stores_first():
    store, s = make()
    s.load()
    view = s.put({"caps": {"per_order_at_risk_gbp": 3}}, by="cloud@ascotwm.com", reason="smaller")
    assert view["values"]["caps"] == {"per_order_at_risk_gbp": 3.0, "per_day_at_risk_gbp": 10.0}
    assert view["versions"] == 1 and view["in_force_from"].startswith(PREFIX)
    stored = store.get(view["in_force_from"])
    assert stored["values"] == view["values"]
    assert stored["updated_by"] == "cloud@ascotwm.com" and stored["reason"] == "smaller" and stored["change"] == "config"
    assert stored["previous"] is None
    view2 = s.put({"operators": ["Mark@Example.com"]}, by="cloud@ascotwm.com")
    assert view2["values"]["operators"] == ["mark@example.com"]
    assert store.get(view2["in_force_from"])["previous"] == view["in_force_from"]


def test_put_refuses_mode_placing_and_unknown_keys():
    store, s = make()
    s.load()
    with pytest.raises(SettingsError, match="mode: not settable through the API"):
        s.put({"mode": "real"}, by="x@y.z")
    with pytest.raises(SettingsError, match="page_access_confirmed: not settable"):
        s.put({"page_access_confirmed": True}, by="x@y.z")
    with pytest.raises(SettingsError, match="placing_enabled: not settable"):
        s.put({"placing_enabled": True}, by="x@y.z")
    with pytest.raises(SettingsError, match="unknown setting"):
        s.put({"colour": "gold"}, by="x@y.z")
    with pytest.raises(SettingsError, match="nothing to set"):
        s.put({}, by="x@y.z")
    with pytest.raises(SettingsError, match="nothing would change"):
        s.put({"caps": {"per_order_at_risk_gbp": 5.0}}, by="x@y.z")
    assert s.versions == 0 and store.names(PREFIX) == []


def test_kill_and_resume_always_store_a_version():
    store, s = make()
    s.load()
    view = s.set_placing(False, by="cloud@ascotwm.com", reason="stop")
    assert view["values"]["placing_enabled"] is False
    assert store.get(view["in_force_from"])["change"] == "kill"
    view = s.set_placing(False, by="cloud@ascotwm.com")
    assert s.versions == 2  # pressed again: recorded again
    view = s.set_placing(True, by="cloud@ascotwm.com")
    assert view["values"]["placing_enabled"] is True
    assert store.get(view["in_force_from"])["change"] == "resume"
    assert s.versions == 3


def test_placing_allowed_matrix():
    store, s = make()
    s.load()
    assert s.placing_allowed("paper") == (False, "placing is disabled: the kill switch is on")
    s.set_placing(True, by="x@y.z")
    ok, why = s.placing_allowed("paper")
    assert ok and why.startswith("paper")
    assert s.placing_allowed("real") == (False, "the stored settings say paper")
    assert s.placing_allowed("live")[0] is False
    store.put(PREFIX, {"values": {"placing_enabled": True, "mode": "real"}}, 9_999_999_999_998)
    s.load()
    assert s.placing_allowed("real") == (False, "Charles has not confirmed that Cloudflare Access covers the page")
    store.put(PREFIX, {"values": {"placing_enabled": True, "mode": "real", "page_access_confirmed": True}}, 9_999_999_999_999)
    s.load()
    assert s.placing_allowed("real") == (True, "real")


def test_current_rereads_when_stale():
    store, s = make(ttl_s=0.0)
    assert s.current()["placing_enabled"] is False
    store.put(PREFIX, {"values": {"placing_enabled": True}}, 9_999_999_999_999)
    assert s.current()["placing_enabled"] is True


def test_unreadable_store_keeps_the_values_in_force():
    class Broken(MemoryStore):
        def names(self, prefix):
            raise OSError("bucket gone")

    s = Settings(Broken())
    view = s.load()
    assert view["values"] == DEFAULTS
    assert "bucket gone" in view["error"]

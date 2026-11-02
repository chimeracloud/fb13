import os
from datetime import date, datetime, timezone

import pytest

from app.activity import Activity
from app.betfair import BetfairRefused, BetfairSession, RECORD_PREFIX, iso_z, london_day_window, london_hhmm, scrub, simplify, summarise
from app.storage import MemoryStore

CREDS = {
    "betfair_username": "user-name",
    "betfair_password": "pass-word",
    "betfair_app_key": "delayed-key",
    "betfair_cert_pem": "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----",
    "betfair_key_pem": "-----BEGIN PRIVATE KEY-----\nxyz\n-----END PRIVATE KEY-----\n",
}


class FakeBetting:
    def __init__(self, result=None, error=None):
        self.result, self.error, self.calls = result if result is not None else [], error, []

    def list_market_catalogue(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.result


class FakeClient:
    def __init__(self, login_error=None, keepalive_error=None, catalogue=None, catalogue_error=None):
        self.login_error, self.keepalive_error = login_error, keepalive_error
        self.logins = self.keepalives = self.logouts = 0
        self.betting = FakeBetting(catalogue, catalogue_error)

    def login(self):
        self.logins += 1
        if self.login_error:
            raise self.login_error

    def keep_alive(self):
        self.keepalives += 1
        if self.keepalive_error:
            raise self.keepalive_error

    def logout(self):
        self.logouts += 1


class Factory:
    def __init__(self, client):
        self.client, self.calls, self.cert_files_existed = client, [], None

    def __call__(self, username, password, app_key, cert_files):
        self.calls.append({"username": username, "app_key": app_key, "cert_files": cert_files})
        self.cert_files_existed = all(os.path.isfile(p) for p in cert_files)
        self.cert_contents = [open(p, encoding="utf-8").read() for p in cert_files]
        return self.client


def make(client):
    store, activity = MemoryStore(), Activity(MemoryStore())
    factory = Factory(client)
    return BetfairSession(store, activity, client_factory=factory, credential=CREDS.__getitem__), store, activity, factory


def test_login_once_with_the_certificate_on_the_delayed_key():
    client = FakeClient()
    s, store, activity, factory = make(client)
    assert s.state == "none" and not s.logged_in
    view = s.login("cloud@chimerasportstrading.com")
    assert view["session"] == "logged_in" and view["key"] == "delayed" and view["login_attempts"] == 1
    assert client.logins == 1
    assert factory.calls[0]["username"] == "user-name" and factory.calls[0]["app_key"] == "delayed-key"
    assert factory.cert_files_existed is True
    assert factory.cert_contents[0].endswith("-----END CERTIFICATE-----\n")
    assert not any(os.path.exists(p) for p in factory.calls[0]["cert_files"])  # removed as soon as the call returned
    s.login("cloud@chimerasportstrading.com")
    assert client.logins == 1 and s.login_attempts == 1  # a second ask while logged in does nothing
    names = store.names(RECORD_PREFIX)
    assert len(names) == 1
    rec = store.get(names[0])
    assert rec["operation"] == "login" and rec["response"] == {"status": "SUCCESS"} and rec["key"] == "delayed"
    assert "user-name" not in str(rec) and "pass-word" not in str(rec) and "delayed-key" not in str(rec)
    assert [e["event"] for e in activity.recent()] == ["betfair_login"]


def test_a_failed_login_latches_and_is_never_retried():
    client = FakeClient(login_error=RuntimeError("certlogin said NO: sessionToken=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"))
    s, store, activity, factory = make(client)
    with pytest.raises(BetfairRefused) as exc:
        s.login("x@y.z")
    assert exc.value.status == 502 and "Not retried" in exc.value.detail
    assert s.state == "failed" and s.error.startswith("RuntimeError: certlogin said NO: sessionToken=[redacted]")
    assert "AbCdEf" not in s.error and "AbCdEf" not in str(store.get(store.names(RECORD_PREFIX)[0]))
    with pytest.raises(BetfairRefused) as again:
        s.login("x@y.z")
    assert again.value.status == 409 and "betfair-reset" in again.value.detail
    assert client.logins == 1 and len(factory.calls) == 1 and s.login_attempts == 1
    assert not any(os.path.exists(p) for p in factory.calls[0]["cert_files"])
    assert activity.recent()[0]["event"] == "betfair_login_failed"
    s.reset("x@y.z")
    assert s.state == "none" and s.error is None
    with pytest.raises(BetfairRefused):
        s.login("x@y.z")  # the fake still fails; the operator asked again, so one more attempt
    assert client.logins == 2 and s.state == "failed"


def test_markets_refused_when_not_logged_in_and_nothing_logs_in_by_itself():
    s, store, activity, factory = make(FakeClient())
    with pytest.raises(BetfairRefused) as exc:
        s.markets(date(2026, 11, 2), by="x@y.z")
    assert exc.value.status == 409 and "not logged in" in exc.value.detail
    assert len(factory.calls) == 0 and store.names(RECORD_PREFIX) == []


def test_markets_asks_for_the_days_gb_and_ie_win_markets_and_records_it():
    client = FakeClient(catalogue=[])
    s, store, activity, factory = make(client)
    s.login("x@y.z")
    found = s.markets(date(2026, 11, 2), by="x@y.z")
    assert found["from_cache"] is False and found["markets"] == [] and found["date"] == "2026-11-02"
    call = client.betting.calls[0]
    assert call["filter"]["eventTypeIds"] == ["7"]
    assert call["filter"]["marketCountries"] == ["GB", "IE"]
    assert call["filter"]["marketTypeCodes"] == ["WIN"]
    assert call["filter"]["marketStartTime"] == {"from": "2026-11-02T00:00:00Z", "to": "2026-11-03T00:00:00Z"}
    assert call["market_projection"] == ["EVENT", "MARKET_START_TIME", "RUNNER_DESCRIPTION"]
    assert call["sort"] == "FIRST_TO_START" and call["max_results"] == 200 and call["lightweight"] is True
    again = s.markets(date(2026, 11, 2), by="x@y.z")
    assert again["from_cache"] is True and len(client.betting.calls) == 1
    recs = [store.get(n) for n in store.names(RECORD_PREFIX)]
    assert [r["operation"] for r in recs] == ["login", "listMarketCatalogue"]
    assert recs[1]["response"] == {"status": "SUCCESS", "count": 0, "markets": []}
    assert recs[1]["request"]["filter"]["eventTypeIds"] == ["7"]
    assert s.calls == 1 and s.last_call_at is not None


def test_keepalive_failure_marks_the_session_expired_and_does_not_log_in_again():
    client = FakeClient(keepalive_error=RuntimeError("INVALID_SESSION_INFORMATION"))
    s, store, activity, factory = make(client)
    s.login("x@y.z")
    s.keep_alive()
    assert s.state == "expired" and not s.logged_in and client.logins == 1
    assert activity.recent()[0]["event"] == "betfair_session_expired"
    with pytest.raises(BetfairRefused):
        s.markets(date(2026, 11, 2), by="x@y.z")
    s.logout("x@y.z")
    assert s.state == "logged_out" and client.logouts == 0  # nothing to give back
    s.reset("x@y.z")
    assert s.state == "none"


def test_logout_gives_the_session_back():
    client = FakeClient()
    s, store, activity, factory = make(client)
    s.login("x@y.z")
    s.keep_alive()
    assert s.last_keepalive_at is not None and client.keepalives == 1
    view = s.logout("x@y.z")
    assert view["session"] == "logged_out" and client.logouts == 1
    ops = [store.get(n)["operation"] for n in store.names(RECORD_PREFIX)]
    assert ops == ["login", "keepAlive", "logout"]


def test_time_helpers_and_scrub():
    start, end = london_day_window(date(2026, 11, 2))  # GMT
    assert iso_z(start) == "2026-11-02T00:00:00Z" and iso_z(end) == "2026-11-03T00:00:00Z"
    start, end = london_day_window(date(2026, 10, 24))  # BST
    assert iso_z(start) == "2026-10-23T23:00:00Z" and iso_z(end) == "2026-10-24T23:00:00Z"
    assert london_hhmm("2026-11-02T13:40:00.000Z") == "13:40"
    assert london_hhmm("2026-10-24T13:40:00.000Z") == "14:40"
    assert scrub("short words only") == "short words only"
    assert scrub("x=AbCdEfGhIjKlMnOpQrStUvWxYz0123 y") == "x=[redacted] y"


def test_simplify_and_summarise_keep_what_the_resolver_needs():
    raw = {
        "marketId": "1.000000001",
        "marketName": "2m Hcap Chs",
        "marketStartTime": "2026-11-02T13:40:00.000Z",
        "event": {"venue": "Cork", "name": "Cork 2nd Nov", "countryCode": "IE"},
        "runners": [{"selectionId": 1, "runnerName": "West Away", "sortPriority": 1, "handicap": 0}],
    }
    m = simplify(raw)
    assert m["market_id"] == "1.000000001" and m["venue"] == "Cork" and m["start_london"] == "13:40"
    assert m["runners"] == [{"selection_id": 1, "name": "West Away", "sort_priority": 1, "handicap": 0}]
    assert summarise([m]) == {"count": 1, "first_off": "13:40", "last_off": "13:40", "venues": ["Cork"], "runners": 1}
    assert summarise([]) == {"count": 0, "first_off": None, "last_off": None, "venues": [], "runners": 0}

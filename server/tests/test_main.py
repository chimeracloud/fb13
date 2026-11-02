import json
import time
from pathlib import Path
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app import main
from app.access import HEADER, AccessVerifier
from app.settings import PREFIX

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ISSUER = "https://chimera.cloudflareaccess.com"
AUD = "aud-test"
OPERATOR = "cloud@ascotwm.com"


class FakeJwkClient:
    def get_signing_key_from_jwt(self, token):
        return SimpleNamespace(key=KEY.public_key())


def bearer(email=OPERATOR):
    now = int(time.time())
    return {HEADER: jwt.encode({"aud": [AUD], "iss": ISSUER, "email": email, "iat": now, "exp": now + 600}, KEY, algorithm="RS256", headers={"kid": "k"})}


@pytest.fixture
def client():
    main.svc = main.build_services()  # a fresh memory store for every test
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def operator(client):
    main.svc.verifier = AccessVerifier("chimera", AUD, jwk_client=FakeJwkClient())
    main.svc.store.put(PREFIX, {"values": {"operators": [OPERATOR]}, "updated_by": "test"}, 1_000_000_000_000)  # 2001: older than anything written now
    main.svc.settings.load()
    return bearer()


def test_health_and_ready_are_open(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["ok"] is True and r.json()["service"] == "fb13-trade-slip-api"
    r = client.get("/ready")
    assert r.status_code == 200
    body = r.json()
    assert body["ready"] is True and body["storage"] == "memory" and body["access_configured"] is False


def test_everything_else_needs_a_token(client):
    for method, path in [("GET", "/info"), ("GET", "/metrics"), ("GET", "/status"), ("GET", "/admin/status"), ("GET", "/admin/config"),
                         ("PUT", "/admin/config"), ("GET", "/admin/stats"), ("GET", "/admin/activity"), ("GET", "/admin/incidents"),
                         ("POST", "/admin/control/kill"), ("GET", "/admin/events")]:
        r = client.request(method, path, json={} if method == "PUT" else None)
        assert r.status_code == 401, path
    assert "only through the page" in client.get("/admin/status").json()["detail"]


def test_unconfigured_sign_in_is_503_even_with_a_token(client):
    r = client.get("/admin/status", headers=bearer())
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]


def test_not_an_operator_is_403(client):
    main.svc.verifier = AccessVerifier("chimera", AUD, jwk_client=FakeJwkClient())
    r = client.get("/admin/status", headers=bearer("someone@example.com"))
    assert r.status_code == 403
    assert "not an operator" in r.json()["detail"]


def test_admin_status_for_an_operator(client, operator):
    r = client.get("/admin/status", headers=operator)
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "paper" and body["placing_enabled"] is False and body["real_allowed"] is False
    assert body["caps"] == {"per_order_at_risk_gbp": 5.0, "per_day_at_risk_gbp": 10.0}
    assert body["signed_in_as"] == OPERATOR and body["operators"] == 1
    assert body["betfair"]["session"] == "none" and body["betfair"]["key"] == "delayed"


def test_config_put_changes_caps_refuses_mode(client, operator):
    r = client.put("/admin/config", headers=operator, json={"caps": {"per_order_at_risk_gbp": 2}, "reason": "smaller for now"})
    assert r.status_code == 200
    view = r.json()
    assert view["values"]["caps"] == {"per_order_at_risk_gbp": 2.0, "per_day_at_risk_gbp": 10.0}
    assert view["updated_by"] == OPERATOR and view["reason"] == "smaller for now" and view["versions"] == 2
    assert client.put("/admin/config", headers=operator, json={"mode": "real"}).status_code == 422
    assert client.put("/admin/config", headers=operator, json={"placing_enabled": True}).status_code == 422
    r = client.put("/admin/config", headers=operator, json={"caps": {"per_order_at_risk_gbp": 50}})
    assert r.status_code == 422 and "day cap" in r.json()["detail"]
    r = client.get("/admin/config", headers=operator)
    assert r.json()["values"]["caps"]["per_order_at_risk_gbp"] == 2.0
    assert "mode" in r.json()["protected"]
    events = client.get("/admin/activity", headers=operator).json()
    assert events[0]["event"] == "config_changed" and events[0]["by"] == OPERATOR
    assert events[0]["detail"]["changes"] == {"caps": {"per_order_at_risk_gbp": 2.0}}


def test_kill_and_resume(client, operator):
    r = client.post("/admin/control/resume", headers=operator, json={"reason": "open"})
    assert r.status_code == 200 and r.json()["placing_enabled"] is True and r.json()["by"] == OPERATOR
    assert client.get("/admin/status", headers=operator).json()["placing_enabled"] is True
    r = client.post("/admin/control/kill", headers=operator)
    assert r.status_code == 200 and r.json()["placing_enabled"] is False
    assert main.svc.settings.values["placing_enabled"] is False
    assert client.post("/admin/control/start", headers=operator).status_code == 404
    events = [e["event"] for e in client.get("/admin/activity", headers=operator).json()]
    assert events[:2] == ["kill", "resume"]
    stored = main.svc.store.get(r.json()["in_force_from"])
    assert stored["change"] == "kill" and stored["updated_by"] == OPERATOR


def test_incidents_is_an_empty_list(client, operator):
    r = client.get("/admin/incidents", headers=operator)
    assert r.status_code == 200 and r.json() == []


def test_stats_info_metrics_status(client, operator):
    client.get("/health")  # one request already counted before stats is read
    stats = client.get("/admin/stats", headers=operator).json()
    assert stats["orders"]["recorded"] == 0 and stats["at_risk_today_gbp"] == {"paper": 0.0, "real": 0.0}
    assert stats["requests"] >= 1 and stats["credential_reads"]["betfair_app_key"] == 0
    info = client.get("/info", headers=operator).json()
    package = json.loads((Path(__file__).resolve().parents[2] / "package.json").read_text("utf-8"))
    assert info["version"] == package["version"]
    assert info["dependencies"]["fastapi"] == "0.150.0" and info["dependencies"]["betfairlightweight"] == "2.24.0"
    assert info["credentials"]["names"]["betfair_app_key"] == "betfair-app-key-delayed"
    assert "value" not in json.dumps(info["credentials"]).lower()
    assert info["betfair"]["session"] == "none" and info["betfair"]["calls"] == 0
    metrics = client.get("/metrics", headers=operator)
    assert metrics.status_code == 200 and "fb13_requests_total" in metrics.text and "fb13_placing_enabled" in metrics.text
    status = client.get("/status", headers=operator).text
    assert status.startswith("FB13 trade slip API, version ")
    assert "mode: paper" in status and "DISABLED" in status and "0 order call(s) (sent only in real mode; paper sends nothing)" in status


def test_events_stream_connects_and_ends(client, operator, monkeypatch):
    monkeypatch.setattr(main, "EVENTS_MAX_S", 0.3)
    monkeypatch.setattr(main, "EVENTS_HEARTBEAT_S", 0.1)
    r = client.get("/admin/events", headers=operator)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    assert r.text.startswith(": connected fb13-trade-slip-api version ")
    assert ": heartbeat" in r.text


def test_activity_shows_the_instance_start(client, operator):
    events = client.get("/admin/activity", headers=operator).json()
    assert any(e["event"] == "instance_start" for e in events)
    start = [e for e in events if e["event"] == "instance_start"][0]
    assert start["detail"]["storage"] == "memory"


# ---- step 2: the Betfair session and the resolver, through the API ----------------


FIXTURE = Path(__file__).parent / "fixtures" / "catalogue-2026-11-02.json"
REAL_MARKETS = json.loads(FIXTURE.read_text(encoding="utf-8"))["response"]["markets"]
BEFORE_RACING = __import__("datetime").datetime(2026, 11, 2, 8, 30, tzinfo=__import__("datetime").timezone.utc)
LINE = {"date": "2026-11-02", "slot": "08:00", "line": {"id": "ln_1", "race": "13:00 Plumpton", "horse": "Hard Stare", "lay_target": "1.75 (5% under)", "betfair_cap": "£125"}, "back": {"price": "1.67", "stake": "3", "where": "BY"}}


class _FakeBetting:
    def __init__(self, catalogue=None):
        self.calls = []
        self.catalogue = catalogue if catalogue is not None else []
        self.order_calls = []
        self.current_responses = []

    def list_market_catalogue(self, **kwargs):
        self.calls.append(kwargs)
        return list(self.catalogue)

    def place_orders(self, **kwargs):
        self.order_calls.append(("placeOrders", kwargs))
        return {"status": "SUCCESS", "marketId": kwargs["market_id"], "instructionReports": [{"status": "SUCCESS", "betId": "400000000001", "orderStatus": "EXECUTABLE", "sizeMatched": 0.0, "instruction": kwargs["instructions"][0]}]}

    def cancel_orders(self, **kwargs):
        self.order_calls.append(("cancelOrders", kwargs))
        return {"status": "SUCCESS", "instructionReports": [{"status": "SUCCESS", "sizeCancelled": 2.0, "instruction": kwargs["instructions"][0]}]}

    def list_current_orders(self, **kwargs):
        self.order_calls.append(("listCurrentOrders", kwargs))
        return self.current_responses.pop(0) if self.current_responses else {"currentOrders": [], "moreAvailable": False}


class _FakeClient:
    def __init__(self, fail=False, catalogue=None):
        self.fail, self.logins, self.logouts, self.betting = fail, 0, 0, _FakeBetting(catalogue)

    def login(self):
        self.logins += 1
        if self.fail:
            raise RuntimeError("cert login refused")

    def keep_alive(self):
        pass

    def logout(self):
        self.logouts += 1


def _wire_betfair(fail=False, catalogue=None):
    from app.betfair import BetfairSession
    from app.orders import Orders

    client = _FakeClient(fail=fail, catalogue=catalogue)
    creds = {"betfair_username": "u", "betfair_password": "p", "betfair_app_key": "k", "betfair_cert_pem": "c", "betfair_key_pem": "k"}
    main.svc.betfair = BetfairSession(main.svc.orders_store, main.svc.activity, client_factory=lambda *a, **k: client, credential=creds.__getitem__)
    main.svc.orders = Orders(main.svc.orders_store, main.svc.settings, main.svc.activity, main.svc.betfair)
    main.svc.orders.clock = lambda: BEFORE_RACING
    return client


def _real_mode():
    main.svc.store.put(PREFIX, {"values": {"operators": [OPERATOR], "mode": "real", "page_access_confirmed": True, "placing_enabled": True}, "updated_by": "test"}, 1_000_000_000_001)
    main.svc.settings.load()


def test_betfair_actions_need_an_operator_and_nothing_logs_in_by_itself(client):
    r = client.get("/betfair/markets")
    assert r.status_code == 401
    assert client.post("/resolve", json={"lines": []}).status_code == 401
    assert client.get("/ready").json()["betfair_session"] == "none"


def test_markets_refused_until_an_operator_logs_in(client, operator):
    fake = _wire_betfair()
    r = client.get("/betfair/markets", headers=operator)
    assert r.status_code == 409 and "not logged in" in r.json()["detail"]
    assert fake.logins == 0
    r = client.post("/resolve", headers=operator, json={"date": "2026-11-02", "lines": [{"id": "a", "race": "13:40 Cork", "horse": "West Away"}]})
    assert r.status_code == 409


def test_login_then_markets_then_resolve(client, operator):
    fake = _wire_betfair()
    r = client.post("/admin/control/betfair-login", headers=operator, json={"reason": "first login, Charles's word"})
    assert r.status_code == 200
    assert r.json()["betfair"]["session"] == "logged_in" and r.json()["by"] == OPERATOR
    assert fake.logins == 1
    assert client.get("/ready").json()["betfair_session"] == "logged_in"
    assert client.get("/admin/status", headers=operator).json()["betfair"]["session"] == "logged_in"
    r = client.get("/betfair/markets?date=2026-11-02", headers=operator)
    assert r.status_code == 200
    body = r.json()
    assert body["summary"] == {"count": 0, "first_off": None, "last_off": None, "venues": [], "runners": 0}
    assert body["from_cache"] is False and fake.betting.calls[0]["max_results"] == 200
    assert client.get("/betfair/markets?date=2026-13-45", headers=operator).status_code == 422
    r = client.post("/resolve", headers=operator, json={"date": "2026-11-02", "lines": [{"id": "a", "race": "13:40 Cork", "horse": "West Away"}]})
    assert r.status_code == 200
    body = r.json()
    assert body["resolved"] == 0 and body["flagged"] == 1 and body["from_cache"] is True
    assert body["resolutions"][0]["id"] == "a" and body["resolutions"][0]["status"] == "flagged"
    assert client.post("/resolve", headers=operator, json={"date": "2026-11-02", "lines": [{"race": "x", "horse": "y", "extra": 1}]}).status_code == 422
    stored = main.svc.orders_store.names("resolutions/2026-11-02/")
    assert len(stored) == 1 and main.svc.orders_store.get(stored[0])["by"] == OPERATOR
    status = client.get("/status", headers=operator).text
    assert "betfair: session logged_in, delayed key, 1 catalogue call(s), 1 login attempt(s)" in status
    r = client.post("/admin/control/betfair-logout", headers=operator)
    assert r.status_code == 200 and r.json()["betfair"]["session"] == "logged_out" and fake.logouts == 1
    events = [e["event"] for e in client.get("/admin/activity", headers=operator).json()]
    assert events[:4] == ["betfair_logout", "resolve", "betfair_catalogue", "betfair_login"]


def test_a_failed_login_is_424_once_then_409_until_reset(client, operator):
    """424, never 502 or 504: Cloudflare replaces an origin's 502 and 504 with its own error page,
    which is how the first login's error reached the page as Cloudflare's words on 2 November 2026."""
    fake = _wire_betfair(fail=True)
    r = client.post("/admin/control/betfair-login", headers=operator)
    assert r.status_code == 424 and "Not retried" in r.json()["detail"]
    r = client.post("/admin/control/betfair-login", headers=operator)
    assert r.status_code == 409 and fake.logins == 1
    r = client.post("/admin/control/betfair-reset", headers=operator)
    assert r.status_code == 200 and r.json()["betfair"]["session"] == "none"
    assert client.post("/admin/control/start", headers=operator).status_code == 404
    assert "betfair-login" in client.post("/admin/control/start", headers=operator).json()["detail"]


# ---- step 3: orders through the API ------------------------------------------------------


def test_order_endpoints_need_an_operator(client):
    for method, path in [("POST", "/orders/build"), ("POST", "/orders/place"), ("POST", "/orders/cancel"), ("GET", "/orders"), ("GET", "/orders/current"), ("POST", "/orders/test")]:
        r = client.request(method, path, json={} if method == "POST" else None)
        assert r.status_code == 401, path


def test_orders_need_the_catalogue_so_a_login_first(client, operator):
    _wire_betfair(catalogue=REAL_MARKETS)
    r = client.post("/orders/build", headers=operator, json=LINE)
    assert r.status_code == 409 and "not logged in" in r.json()["detail"]
    assert client.post("/orders/build", headers=operator, json={**LINE, "extra": 1}).status_code == 422
    assert client.post("/orders/place", headers=operator, json={**LINE, "ticket": "nothex"}).status_code == 422


def test_paper_order_end_to_end_builds_records_and_sends_nothing(client, operator):
    fake = _wire_betfair(catalogue=REAL_MARKETS)
    main.svc.settings.set_placing(True, "test", "paper trial")
    assert client.post("/admin/control/betfair-login", headers=operator).status_code == 200
    r = client.post("/orders/build", headers=operator, json=LINE)
    assert r.status_code == 200
    built = r.json()
    assert built["status"] == "ok" and built["mode"] == "paper" and built["price"] == "1.75" and built["size"] == "2.86" and built["liability"] == "2.15"
    assert built["market_id"] == "1.264841544" and built["selection_id"] == 81578849 and built["runner_name"] == "Hard Stare"
    r = client.post("/orders/place", headers=operator, json={**LINE, "ticket": built["ticket"], "reason": "paper trial"})
    assert r.status_code == 200
    placed = r.json()
    assert placed["event"] == "placed" and placed["sent"] is False and placed["bet_id"] is None and placed["by"] == OPERATOR
    assert fake.betting.order_calls == []  # paper: nothing left the server
    r = client.post("/orders/place", headers=operator, json={**LINE, "ticket": built["ticket"]})
    assert r.status_code == 409 and "never placed twice" in r.json()["detail"]
    r = client.get("/orders?date=2026-11-02", headers=operator)
    assert r.status_code == 200 and r.json()["at_risk"] == {"paper": "2.15", "real": "0.00"} and [x["event"] for x in r.json()["records"]] == ["placed", "refused"]
    r = client.get("/orders/current?date=2026-11-02", headers=operator)
    assert r.status_code == 200 and r.json()["sent"] is False and len(r.json()["orders"]) == 1
    r = client.post("/orders/cancel", headers=operator, json={"date": "2026-11-02", "order_ref": placed["order_ref"], "reason": "trial over"})
    assert r.status_code == 200 and r.json()["event"] == "cancelled" and r.json()["sent"] is False
    assert client.get("/orders/current?date=2026-11-02", headers=operator).json()["orders"] == []
    r = client.post("/orders/test", headers=operator, json={"date": "2026-11-02", "market_id": "1.264841544", "selection_id": 81578849, "confirmation": "I confirm the real test order: back 2.00 at 1000"})
    assert r.status_code == 409 and "the stored settings say paper" in r.json()["detail"]
    assert fake.betting.order_calls == []
    stored = main.svc.orders_store.names("orders/2026-11-02/")
    assert [main.svc.orders_store.get(n)["event"] for n in stored] == ["placed", "refused", "cancelled"]
    status = client.get("/status", headers=operator).text
    assert "0 order call(s) (sent only in real mode; paper sends nothing)" in status
    events = [e["event"] for e in client.get("/admin/activity", headers=operator).json()]
    assert events[:3] == ["order_cancelled", "order_refused", "order_placed"]


def test_the_test_order_end_to_end_in_real_mode(client, operator):
    fake = _wire_betfair(catalogue=REAL_MARKETS)
    _real_mode()
    assert client.post("/admin/control/betfair-login", headers=operator).status_code == 200
    body = {"date": "2026-11-02", "market_id": "1.264841544", "selection_id": 81578849, "confirmation": "yes"}
    r = client.post("/orders/test", headers=operator, json=body)
    assert r.status_code == 409 and "exact words" in r.json()["detail"] and fake.betting.order_calls == []
    fake.betting.current_responses = [
        {"currentOrders": [{"betId": "400000000001", "status": "EXECUTABLE", "sizeMatched": 0.0, "sizeRemaining": 2.0, "priceSize": {"price": 1000.0, "size": 2.0}}], "moreAvailable": False},
        {"currentOrders": [], "moreAvailable": False},
    ]
    r = client.post("/orders/test", headers=operator, json={**body, "confirmation": "I confirm the real test order: back 2.00 at 1000"})
    assert r.status_code == 200, r.text
    rec = r.json()
    assert rec["event"] == "test_order" and rec["verdict"] == "passed: placed, seen, cancelled, gone" and rec["bet_id"] == "400000000001"
    assert [c[0] for c in fake.betting.order_calls] == ["placeOrders", "listCurrentOrders", "cancelOrders", "listCurrentOrders"]
    sent = fake.betting.order_calls[0][1]
    assert sent["market_id"] == "1.264841544" and sent["customer_strategy_ref"] == "FB13-TEST" and sent["instructions"][0]["side"] == "BACK"
    assert sent["instructions"][0]["limitOrder"] == {"size": 2.0, "price": 1000.0, "persistenceType": "LAPSE"}
    assert client.get("/orders?date=2026-11-02", headers=operator).json()["at_risk"] == {"paper": "0.00", "real": "2.00"}
    betfair_records = [main.svc.orders_store.get(n)["operation"] for n in main.svc.orders_store.names("betfair/")]
    assert betfair_records == ["login", "listMarketCatalogue", "placeOrders", "listCurrentOrders", "cancelOrders", "listCurrentOrders"]
    status = client.get("/status", headers=operator).text
    assert "4 order call(s)" in status

"""FB13 trade slip API: the server behind the page's Place button.

Version 1, step 1 (2 November 2026): the shell. Settings, the caps, the kill
switch, the admin endpoint set of CHI-POL-008 (thirteen endpoints with the
18 September 2026 amendment) and the five observability endpoints. No
Betfair call is made in this version. Every endpoint but /health and /ready
needs a Cloudflare Access token for an operator (app/access.py); the page
reaches this service only through its own hostname (functions/api/[[path]].js).

  GET  /health                  open: liveness
  GET  /ready                   open: readiness (storage answers, settings loaded)
  GET  /info                    static metadata: name, version, commit, pins, credential names
  GET  /metrics                 Prometheus text
  GET  /status                  one screen of plain text
  GET  /admin/status            health, version, uptime, mode, placing, caps
  GET  /admin/config            the stored settings in force
  PUT  /admin/config            {"caps": {...}, "operators": [...], "reason": "..."}; mode is not settable here
  GET  /admin/stats             counters
  GET  /admin/activity          the last 100 events, newest first
  GET  /admin/events            the same, live (server-sent events)
  GET  /admin/incidents         [] (stub; CHI-POL-043 interim)
  POST /admin/control/kill      stop all placing, paper and real, at once
  POST /admin/control/resume    allow placing again

Step 2 (read only, 2 November 2026). Nothing logs in by itself: an operator asks.
  POST /admin/control/betfair-login    log in once, with the certificate, on the Delayed key
  POST /admin/control/betfair-logout   give the session back
  POST /admin/control/betfair-reset    clear a failed or expired session so another login may be asked for
  GET  /betfair/markets?date=          the day's GB and IE win markets with runners (listMarketCatalogue)
  POST /resolve                        {"date": "...", "lines": [{"id", "race", "horse"}]} -> market and runner, or a flag

No order call exists in this version. Cancelling open orders is a separate,
deliberate call and arrives in step 3.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

from app import logconfig
from app.access import HEADER, AccessVerifier, Refused, operator_email
from app.activity import Activity
from app.betfair import LONDON, BetfairRefused, BetfairSession, summarise
from app.credentials import credential_names, reads_so_far
from app.metrics import Metrics
from app.models import CancelRequest, ConfigUpdate, ControlBody, OrderRequest, PlaceRequest, ResolveRequest, TestOrderRequest
from app.orders import OrderRefused, Orders
from app.resolver import resolve_lines
from app.settings import Settings, SettingsError
from app.storage import Store, open_store
from app.version import COMMIT, SERVICE_NAME, UNIT, VERSION, build_label

logconfig.configure()
log = logging.getLogger("fb13")

PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "chiops")
REGION = "europe-west2"
EVENTS_MAX_S = 300.0  # one server-sent-events request lasts at most this; the page reconnects
EVENTS_HEARTBEAT_S = 15.0
INTERIM = [
    "credentials: Secret Manager read directly by app/credentials.py (CHI-POL-040 §6)",
    "incidents: GET /admin/incidents returns an empty list until the Incident FSU exists (CHI-POL-043)",
    "sign-in: Cloudflare Access JWT verified here, operators listed in the stored settings",
]


@dataclass
class Services:
    store: Store
    orders_store: Store
    settings: Settings
    activity: Activity
    verifier: AccessVerifier
    metrics: Metrics
    betfair: BetfairSession
    orders: Orders


def build_services() -> Services:
    store = open_store(os.environ.get("FB13_CONFIG_BUCKET", "").strip() or None)
    orders_store = open_store(os.environ.get("FB13_ORDERS_BUCKET", "").strip() or None)
    activity = Activity(store)
    settings = Settings(store)
    betfair = BetfairSession(orders_store, activity)
    return Services(
        store=store,
        orders_store=orders_store,
        settings=settings,
        activity=activity,
        verifier=AccessVerifier(os.environ.get("CF_ACCESS_TEAM_DOMAIN", ""), os.environ.get("CF_ACCESS_AUD", "")),
        metrics=Metrics(),
        betfair=betfair,
        orders=Orders(orders_store, settings, activity, betfair),
    )


def london_today() -> date:
    return datetime.now(LONDON).date()


def parse_day(text: str | None) -> date:
    if not text:
        return london_today()
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise HTTPException(422, "date must be YYYY-MM-DD") from exc


svc = build_services()


def pinned_dependencies() -> dict[str, str]:
    """The pins in requirements.txt, as shipped in the image (next to this package) or in the checkout."""
    here = Path(__file__).resolve()
    for candidate in (here.parents[1] / "requirements.txt",):
        if candidate.is_file():
            out: dict[str, str] = {}
            for line in candidate.read_text("utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "==" in line:
                    name, _, version = line.partition("==")
                    out[name.strip()] = version.strip()
            return out
    return {}


# ---- lifespan and middleware -------------------------------------------------


@asynccontextmanager
async def lifespan(_: FastAPI):
    svc.activity.bind_loop(asyncio.get_running_loop())
    await asyncio.to_thread(svc.settings.load)  # the stored values govern from the first request
    loaded = await asyncio.to_thread(svc.activity.load_recent, 50)
    await asyncio.to_thread(
        svc.activity.record,
        "instance_start",
        None,
        version=VERSION,
        commit=COMMIT or None,
        storage=svc.store.kind,
        settings_from=svc.settings.source or "defaults (nothing stored yet)",
        settings_error=svc.settings.error,
        earlier_events_reloaded=loaded,
    )
    yield
    keepalive = getattr(app.state, "keepalive", None)
    if keepalive is not None:
        keepalive.cancel()
    if svc.betfair.logged_in:
        await asyncio.to_thread(svc.betfair.logout, "instance_stop")  # the session dies with the instance; say so to Betfair
    await asyncio.to_thread(svc.activity.record, "instance_stop", None)


app = FastAPI(title=f"{UNIT} trade slip API", version=VERSION, lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def trace_from(headers: Any) -> str:
    cloud = headers.get("x-cloud-trace-context") or ""
    if cloud:
        return cloud.split("/", 1)[0][:64]
    parent = headers.get("traceparent") or ""
    parts = parent.split("-")
    if len(parts) >= 3 and len(parts[1]) == 32:
        return parts[1]
    return uuid.uuid4().hex


@app.middleware("http")
async def observe(request: Request, call_next):
    token = logconfig.trace_id_var.set(trace_from(request.headers))
    started = time.monotonic()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        ms = (time.monotonic() - started) * 1000
        path = request.url.path
        route = path if path in KNOWN_PATHS else ("/admin/control/{action}" if path.startswith("/admin/control/") else "other")
        svc.metrics.observe(request.method, route, status, ms)
        if path not in ("/health", "/ready"):
            log.info("%s %s %s", request.method, path, status, extra={"event": "request", "method": request.method, "path": path, "status": status, "ms": round(ms, 1)})
        logconfig.trace_id_var.reset(token)


# ---- the gate ----------------------------------------------------------------


def require_operator(request: Request) -> str:
    """The signed-in operator's email, or an HTTP refusal. Sync: FastAPI runs it in a worker thread."""
    token = request.headers.get(HEADER)
    try:
        if not token:
            raise Refused(401, "no Access token: this API answers only through the page")
        claims = svc.verifier.verify(token)
        return operator_email(claims, svc.settings.current()["operators"])
    except Refused as exc:
        svc.metrics.refused()
        log.warning("refused %s %s: %s", request.method, request.url.path, exc.detail, extra={"event": "refused", "status": exc.status})
        raise HTTPException(exc.status, exc.detail) from exc


# ---- observability -----------------------------------------------------------


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": SERVICE_NAME, "version": VERSION}


@app.get("/ready")
def ready() -> JSONResponse:
    storage_error: str | None = None
    try:
        svc.store.reachable()
    except Exception as exc:  # noqa: BLE001
        storage_error = f"{type(exc).__name__}: {exc}"
    s = svc.settings
    is_ready = storage_error is None and s.loaded_at is not None and s.error is None
    body = {
        "ready": is_ready,
        "storage": svc.store.kind,
        "storage_error": storage_error,
        "settings_loaded_at": s.loaded_at,
        "settings_error": s.error,
        "access_configured": svc.verifier.configured,
        "betfair_session": svc.betfair.state,
    }
    return JSONResponse(body, status_code=200 if is_ready else 503)


@app.get("/info")
def info(email: str = Depends(require_operator)) -> dict[str, Any]:
    return {
        "name": SERVICE_NAME,
        "unit": UNIT,
        "version": VERSION,
        "commit": COMMIT or None,
        "python": platform.python_version(),
        "project": PROJECT,
        "region": REGION,
        "storage": {"config": svc.store.location, "orders": svc.orders_store.location, "kind": svc.store.kind},
        "dependencies": pinned_dependencies(),
        "credentials": {"names": credential_names(), "reads_this_process": reads_so_far()},
        "access": {"configured": svc.verifier.configured, "issuer": svc.verifier.issuer or None, "certs": svc.verifier.certs_url or None},
        "betfair": {
            **svc.betfair.view(),
            "note": "login, keepAlive, logout, listMarketCatalogue on the Delayed key; placeOrders, cancelOrders and listCurrentOrders exist from step 3 and are sent only in real mode, behind the kill switch and the caps; paper sends nothing",
        },
        "interim": INTERIM,
    }


@app.get("/metrics")
def metrics(email: str = Depends(require_operator)) -> PlainTextResponse:
    v = svc.settings.values
    gauges = {
        "fb13_placing_enabled": 1 if v["placing_enabled"] else 0,
        "fb13_mode_real": 1 if v["mode"] == "real" else 0,
        "fb13_real_allowed": 1 if svc.settings.real_allowed else 0,
        "fb13_cap_per_order_gbp": v["caps"]["per_order_at_risk_gbp"],
        "fb13_cap_per_day_gbp": v["caps"]["per_day_at_risk_gbp"],
        "fb13_operators": len(v["operators"]),
        "fb13_settings_versions": svc.settings.versions,
        "fb13_activity_store_errors": svc.activity.store_errors,
        "fb13_events_subscribers": svc.activity.subscribers,
    }
    text = svc.metrics.render(gauges, {"service": SERVICE_NAME, "version": VERSION})
    return PlainTextResponse(text, media_type="text/plain; version=0.0.4; charset=utf-8")


@app.get("/status")
def status_text(email: str = Depends(require_operator)) -> PlainTextResponse:
    s = svc.settings
    v = s.values
    b = svc.betfair.view()
    totals = svc.metrics.totals()
    lines = [
        f"{UNIT} trade slip API, {build_label()}",
        f"mode: {v['mode']}" + ("" if s.real_allowed else " (real refused: " + ("the stored settings say paper" if v["mode"] != "real" else "page access not yet confirmed by Charles") + ")"),
        f"placing: {'enabled' if v['placing_enabled'] else 'DISABLED (kill switch on)'}",
        f"caps: £{v['caps']['per_order_at_risk_gbp']:.2f} at risk an order, £{v['caps']['per_day_at_risk_gbp']:.2f} a mode a London day",
        f"operators: {len(v['operators'])}" + ("" if v["operators"] else " (nobody can sign in)"),
        f"sign-in: Cloudflare Access token, {'configured' if svc.verifier.configured else 'NOT configured: everything refused'}",
        f"storage: {svc.store.location}, settings in force from {s.source or 'the defaults (nothing stored yet)'}",
        f"settings: {s.versions} version(s) stored" + (f", error: {s.error}" if s.error else "") + (f", problems: {'; '.join(s.problems)}" if s.problems else ""),
        f"activity: {svc.activity.recorded} event(s) this instance, {svc.activity.store_errors} not stored",
        f"requests: {totals['requests']} answered, {totals['auth_refusals']} refused at the gate, {totals['server_errors']} server errors",
        f"betfair: session {b['session']}, delayed key, {b['calls']} catalogue call(s), {b['login_attempts']} login attempt(s)"
        + (f", logged in at {b['logged_in_at']}" if b["logged_in_at"] else "")
        + (f", last keepAlive {b['last_keepalive_at']}" if b["last_keepalive_at"] else "")
        + (f", error: {b['error']}" if b["error"] else "")
        + f"; {b['order_calls']} order call(s) (sent only in real mode; paper sends nothing)",
        f"uptime: {totals['uptime_s']} s",
    ]
    return PlainTextResponse("\n".join(lines) + "\n")


# ---- set 1: parameters (admin) -----------------------------------------------


@app.get("/admin/status")
def admin_status(email: str = Depends(require_operator)) -> dict[str, Any]:
    s = svc.settings
    v = s.values
    return {
        "ok": True,
        "service": SERVICE_NAME,
        "unit": UNIT,
        "version": VERSION,
        "commit": COMMIT or None,
        "uptime_s": round(svc.metrics.uptime_s, 1),
        "mode": v["mode"],
        "real_allowed": s.real_allowed,
        "page_access_confirmed": v["page_access_confirmed"],
        "placing_enabled": v["placing_enabled"],
        "caps": dict(v["caps"]),
        "operators": len(v["operators"]),
        "signed_in_as": email,
        "access_configured": svc.verifier.configured,
        "storage": svc.store.kind,
        "settings_in_force_from": s.source,
        "settings_error": s.error,
        "settings_problems": list(s.problems),
        "betfair": svc.betfair.view(),
    }


@app.get("/admin/config")
def get_config(email: str = Depends(require_operator)) -> dict[str, Any]:
    svc.settings.current()
    return svc.settings.view()


@app.put("/admin/config")
def put_config(body: ConfigUpdate, email: str = Depends(require_operator)) -> dict[str, Any]:
    changes = body.model_dump(exclude_none=True)
    reason = changes.pop("reason", None)
    try:
        view = svc.settings.put(changes, by=email, reason=reason)
    except SettingsError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - the store refused: nothing changed
        log.exception("settings not stored")
        raise HTTPException(503, f"the settings could not be stored: {type(exc).__name__}") from exc
    svc.activity.record("config_changed", email, changes=changes, reason=reason, version=view["in_force_from"])
    return view


@app.get("/admin/stats")
def stats(email: str = Depends(require_operator)) -> dict[str, Any]:
    v = svc.settings.values
    return {
        **svc.metrics.totals(),
        "caps": dict(v["caps"]),
        "at_risk_today_gbp": {"paper": 0.0, "real": 0.0},
        "orders": {"recorded": 0, "note": "order records begin at step 3; nothing has been built or placed"},
        "settings_versions": svc.settings.versions,
        "activity": {"recorded_this_instance": svc.activity.recorded, "not_stored": svc.activity.store_errors, "subscribers": svc.activity.subscribers},
        "credential_reads": reads_so_far(),
    }


@app.get("/admin/activity")
def activity(email: str = Depends(require_operator)) -> list[dict[str, Any]]:
    return svc.activity.recent(100)


@app.get("/admin/events")
async def events(email: str = Depends(require_operator)) -> StreamingResponse:
    queue = svc.activity.subscribe()
    loop = asyncio.get_running_loop()

    async def stream():
        try:
            yield f": connected {SERVICE_NAME} {build_label()}\n\n"
            deadline = loop.time() + EVENTS_MAX_S
            while loop.time() < deadline:
                try:
                    ev = await asyncio.wait_for(queue.get(), timeout=EVENTS_HEARTBEAT_S)
                except TimeoutError:
                    yield ": heartbeat\n\n"
                    continue
                yield f"id: {ev['id']}\nevent: {ev['event']}\ndata: {json.dumps(ev, ensure_ascii=False)}\n\n"
        finally:
            svc.activity.unsubscribe(queue)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/admin/incidents")
def incidents(email: str = Depends(require_operator)) -> list[dict[str, Any]]:
    # Stub by design: the surface exists, the content waits for the Incident FSU (CHI-POL-008
    # amendment of 18 Sep 2026; CHI-POL-043). An empty list, never an error, never a 404.
    return []


ACTIONS = ("kill", "resume", "betfair-login", "betfair-logout", "betfair-reset")


@app.post("/admin/control/{action}")
async def control(action: str, body: ControlBody | None = None, email: str = Depends(require_operator)) -> dict[str, Any]:
    reason = body.reason if body else None
    if action not in ACTIONS:
        raise HTTPException(404, f"actions of this unit: {', '.join(ACTIONS)}")
    if action in ("kill", "resume"):
        try:
            view = await asyncio.to_thread(svc.settings.set_placing, action == "resume", email, reason)
        except Exception as exc:  # noqa: BLE001 - the store refused: the stored value, whatever it is, still governs
            log.exception("%s not stored", action)
            raise HTTPException(503, f"{action} could not be stored: {type(exc).__name__}") from exc
        await asyncio.to_thread(svc.activity.record, action, email, reason=reason, version=view["in_force_from"])
        return {
            "action": action,
            "placing_enabled": view["values"]["placing_enabled"],
            "in_force_from": view["in_force_from"],
            "by": email,
            "at": view["updated_at"],
        }
    try:
        if action == "betfair-login":
            was_logged_in = svc.betfair.logged_in
            view = await asyncio.to_thread(svc.betfair.login, email)
            if not was_logged_in and svc.betfair.logged_in:
                app.state.keepalive = asyncio.create_task(svc.betfair.keepalive_loop(), name="betfair-keepalive")
        elif action == "betfair-logout":
            view = await asyncio.to_thread(svc.betfair.logout, email)
        else:
            view = await asyncio.to_thread(svc.betfair.reset, email)
    except BetfairRefused as exc:
        raise HTTPException(exc.status, exc.detail) from exc
    return {"action": action, "by": email, "reason": reason, "betfair": view}


# ---- set 3: content (step 2, read only) ----------------------------------------


@app.get("/betfair/markets")
def betfair_markets(
    day_text: str | None = Query(default=None, alias="date", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    email: str = Depends(require_operator),
) -> dict[str, Any]:
    day = parse_day(day_text)
    try:
        found = svc.betfair.markets(day, by=email)
    except BetfairRefused as exc:
        raise HTTPException(exc.status, exc.detail) from exc
    return {**found, "summary": summarise(found["markets"])}


@app.post("/resolve")
def resolve(body: ResolveRequest, email: str = Depends(require_operator)) -> dict[str, Any]:
    day = parse_day(body.date)
    try:
        found = svc.betfair.markets(day, by=email)
    except BetfairRefused as exc:
        raise HTTPException(exc.status, exc.detail) from exc
    lines = [line.model_dump() for line in body.lines]
    resolutions = resolve_lines(day, lines, found["markets"])
    resolved = sum(1 for r in resolutions if r["status"] == "resolved")
    record = {
        "at": datetime.now(LONDON).isoformat(timespec="milliseconds"),
        "by": email,
        "date": day.isoformat(),
        "catalogue_fetched_at": found["fetched_at"],
        "lines": lines,
        "resolutions": resolutions,
    }
    try:
        svc.orders_store.put(f"resolutions/{day.isoformat()}/", record)
    except Exception as exc:  # noqa: BLE001
        log.error("resolution not stored: %s", type(exc).__name__, extra={"event": "resolution_store_error"})
    svc.activity.record("resolve", email, date=day.isoformat(), lines=len(lines), resolved=resolved, flagged=len(lines) - resolved)
    return {"date": day.isoformat(), "catalogue_fetched_at": found["fetched_at"], "from_cache": found["from_cache"], "resolved": resolved, "flagged": len(lines) - resolved, "resolutions": resolutions}


# ---- step 3: orders. Paper builds and records; real sends, behind the stored mode and the kill switch. ----


def _markets_for(day: date, email: str) -> list[dict[str, Any]]:
    try:
        return svc.betfair.markets(day, by=email)["markets"]
    except BetfairRefused as exc:
        raise HTTPException(exc.status, exc.detail) from exc


@app.post("/orders/build")
def orders_build(body: OrderRequest, email: str = Depends(require_operator)) -> dict[str, Any]:
    """What a Place would send, and every reason it would be refused. Nothing is sent or stored."""
    day = parse_day(body.date)
    return svc.orders.build(body.model_dump(), day, _markets_for(day, email))


@app.post("/orders/place")
def orders_place(body: PlaceRequest, email: str = Depends(require_operator)) -> dict[str, Any]:
    day = parse_day(body.date)
    try:
        return svc.orders.place(body.model_dump(), day, _markets_for(day, email), email)
    except OrderRefused as exc:
        raise HTTPException(exc.status, exc.detail) from exc


@app.post("/orders/cancel")
def orders_cancel(body: CancelRequest, email: str = Depends(require_operator)) -> dict[str, Any]:
    """A separate, deliberate call."""
    try:
        return svc.orders.cancel(body.order_ref, body.reason, email, parse_day(body.date))
    except OrderRefused as exc:
        raise HTTPException(exc.status, exc.detail) from exc


@app.get("/orders")
def orders_view(
    day_text: str | None = Query(default=None, alias="date", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    email: str = Depends(require_operator),
) -> dict[str, Any]:
    return svc.orders.view(parse_day(day_text))


@app.get("/orders/current")
def orders_current(
    day_text: str | None = Query(default=None, alias="date", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    email: str = Depends(require_operator),
) -> dict[str, Any]:
    try:
        return svc.orders.current(parse_day(day_text), email)
    except (OrderRefused, BetfairRefused) as exc:
        raise HTTPException(exc.status, exc.detail) from exc


@app.post("/orders/test")
def orders_test(body: TestOrderRequest, email: str = Depends(require_operator)) -> dict[str, Any]:
    """One BACK of 2.00 at 1000, placed, seen, cancelled, seen gone. Real mode only, with the sentence typed."""
    day = parse_day(body.date)
    try:
        return svc.orders.test_order(body.market_id, body.selection_id, body.confirmation, email, day, _markets_for(day, email))
    except OrderRefused as exc:
        raise HTTPException(exc.status, exc.detail) from exc


KNOWN_PATHS = frozenset(getattr(r, "path", "") for r in app.routes)

"""The Betfair session and the read-only calls of step 2.

Charles's rules of 2 November 2026: the DELAYED application key only; log in
once with the certificate, keep the session with keepAlive, and never loop on
a login failure. A failed login latches: the state becomes "failed", the
error is kept in words, and no further login is attempted until an operator
resets the latch by hand (betfair-reset). listMarketCatalogue for the day's
GB and IE horse racing WIN markets (event type 7).

Step 3 adds the order calls: placeOrders, cancelOrders, listCurrentOrders.
This module only sends and records; app/orders.py decides whether anything
may be sent at all (the stored mode, the kill switch, the caps, one order per
line). In paper mode nothing here is ever called for an order.

Every request to Betfair and every response is recorded, append-only, in the
orders bucket under betfair/<UTC date>/, with the time and the operator who
asked. Each record also carries the HTTP trail of the call: every send the
requests library attempted, with method, URL (no query), status and time, or
the error where no response came, so the record answers whether anything
reached Betfair (RecordingSession). Never a secret: the session token, the
application key, the username and the password are not written anywhere,
and any token-shaped run of characters in an error message is redacted
before it is stored or logged.

A failed call to Betfair is answered 424 (failed dependency), never 502 or
504: Cloudflare replaces an origin's 502 and 504 with its own error page,
which is how the first login's error reached the page as Cloudflare's words
on 2 November 2026 instead of the server's.
The certificate and key are written to a private temporary directory on the
container's in-memory filesystem for the login call only, and removed as soon
as the call returns, whatever happened.

The client library is betfairlightweight 2.24.0, as CLE V2 uses.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import tempfile
import threading
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable
from urllib.parse import urlsplit, urlunsplit
from zoneinfo import ZoneInfo

import requests

from app.credentials import get_credential
from app.storage import Store

log = logging.getLogger(__name__)

LONDON = ZoneInfo("Europe/London")
EVENT_TYPE_HORSE_RACING = "7"
COUNTRIES = ["GB", "IE"]
MARKET_TYPES = ["WIN"]
MARKET_PROJECTION = ["EVENT", "MARKET_START_TIME", "RUNNER_DESCRIPTION"]
MAX_MARKETS = 200
KEEPALIVE_EVERY_S = 15 * 60
CATALOGUE_FRESH_S = 10 * 60
RECORD_PREFIX = "betfair/"

_TOKENISH = re.compile(r"[A-Za-z0-9+/_\-]{24,}")


class BetfairRefused(Exception):
    def __init__(self, status: int, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def scrub(text: Any) -> str:
    """Any token-shaped run of 24 or more characters is replaced before an error is kept."""
    return _TOKENISH.sub("[redacted]", str(text))


def london_day_window(day: date) -> tuple[datetime, datetime]:
    """Midnight to midnight in London, as UTC instants."""
    start = datetime(day.year, day.month, day.day, tzinfo=LONDON)
    return start.astimezone(timezone.utc), (start + timedelta(days=1)).astimezone(timezone.utc)


def iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_betfair_time(s: str) -> datetime:
    """'2026-11-02T13:40:00.000Z' -> an aware UTC datetime."""
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)


def london_hhmm(s: str) -> str:
    return parse_betfair_time(s).astimezone(LONDON).strftime("%H:%M")


def simplify(m: dict[str, Any]) -> dict[str, Any]:
    """One listMarketCatalogue entry, kept to what the resolver and the page need."""
    event = m.get("event") or {}
    return {
        "market_id": m.get("marketId"),
        "market_name": m.get("marketName"),
        "start_time": m.get("marketStartTime"),
        "start_london": london_hhmm(m["marketStartTime"]) if m.get("marketStartTime") else None,
        "venue": event.get("venue"),
        "event_name": event.get("name"),
        "country": event.get("countryCode"),
        "runners": [
            {
                "selection_id": r.get("selectionId"),
                "name": r.get("runnerName"),
                "sort_priority": r.get("sortPriority"),
                "handicap": r.get("handicap", 0),
            }
            for r in (m.get("runners") or [])
        ],
    }


def summarise(markets: list[dict[str, Any]]) -> dict[str, Any]:
    ordered = sorted(markets, key=lambda m: m.get("start_time") or "")
    return {
        "count": len(ordered),
        "first_off": ordered[0]["start_london"] if ordered else None,
        "last_off": ordered[-1]["start_london"] if ordered else None,
        "venues": sorted({m["venue"] for m in ordered if m.get("venue")}),
        "runners": sum(len(m["runners"]) for m in ordered),
    }


class RecordingSession(requests.Session):
    """A requests session that keeps the trail of every send: method, URL without its query,
    status and time, or the error where no response came. Never the body, never a header.
    drain() hands the trail over for the record and starts a new one."""

    def __init__(self) -> None:
        super().__init__()
        self.trail: list[dict[str, Any]] = []

    def send(self, request, **kwargs):  # type: ignore[override]
        parts = urlsplit(request.url or "")
        entry: dict[str, Any] = {"at": now_iso(), "method": request.method, "url": urlunsplit((parts.scheme, parts.netloc, parts.path, "", "")), "status": None, "ms": None, "error": None}
        self.trail.append(entry)
        started = time.monotonic()
        try:
            response = super().send(request, **kwargs)
        except Exception as exc:  # noqa: BLE001 - recorded, then raised as it was
            entry["ms"] = round((time.monotonic() - started) * 1000, 1)
            entry["error"] = f"{type(exc).__name__}: {scrub(exc)}"
            raise
        entry["ms"] = round((time.monotonic() - started) * 1000, 1)
        entry["status"] = response.status_code
        return response

    def drain(self) -> list[dict[str, Any]]:
        trail, self.trail = self.trail, []
        return trail


def http_trail(client: Any) -> list[dict[str, Any]] | None:
    """The HTTP exchanges since the last record, or None where the client's session keeps none."""
    session = getattr(client, "session", None)
    drain = getattr(session, "drain", None)
    return drain() if callable(drain) else None


def default_client_factory(username: str, password: str, app_key: str, cert_files: tuple[str, str]):
    import betfairlightweight  # here, so that importing the app loads nothing of it

    # The certificate and key go as a pair (a tuple). requests keys its connection pool on
    # the client certificate and unpacks only a tuple; a list is unhashable there, which is
    # what failed the first login on 2 November 2026 before anything was sent.
    return betfairlightweight.APIClient(username, password, app_key=app_key, cert_files=tuple(cert_files), session=RecordingSession())


class BetfairSession:
    """One login, one session, read-only calls. States: none, logged_in, expired, failed, logged_out."""

    def __init__(
        self,
        record_store: Store,
        activity: Any,
        client_factory: Callable[..., Any] | None = None,
        credential: Callable[[str], str] = get_credential,
    ) -> None:
        self.store = record_store
        self.activity = activity
        self._factory = client_factory or default_client_factory
        self._credential = credential
        self._client: Any = None
        self._lock = threading.RLock()
        self._catalogue: dict[str, tuple[float, list[dict[str, Any]], str]] = {}
        self.state = "none"
        self.error: str | None = None
        self.failed_at: str | None = None
        self.logged_in_at: str | None = None
        self.last_keepalive_at: str | None = None
        self.last_call_at: str | None = None
        self.login_attempts = 0
        self.calls = 0
        self.order_calls = 0
        self.records = 0
        self.record_errors = 0

    # ---- recording --------------------------------------------------------

    def _record(self, operation: str, by: str | None, request: Any, response: Any, ms: float, http: list[dict[str, Any]] | None = None) -> None:
        obj = {
            "at": now_iso(),
            "operation": operation,
            "key": "delayed",
            "by": by,
            "request": request,
            "response": response,
            "http": http,
            "ms": round(ms, 1),
            "session_state": self.state,
        }
        try:
            self.store.put(f"{RECORD_PREFIX}{obj['at'][:10]}/", obj)
            self.records += 1
        except Exception as exc:  # noqa: BLE001
            self.record_errors += 1
            log.error("betfair record not stored: %s: %s", type(exc).__name__, scrub(exc), extra={"event": "betfair_record_error"})

    # ---- session ----------------------------------------------------------

    @property
    def logged_in(self) -> bool:
        return self.state == "logged_in" and self._client is not None

    def view(self) -> dict[str, Any]:
        return {
            "session": self.state,
            "key": "delayed",
            "logged_in_at": self.logged_in_at,
            "last_keepalive_at": self.last_keepalive_at,
            "last_call_at": self.last_call_at,
            "login_attempts": self.login_attempts,
            "calls": self.calls,
            "order_calls": self.order_calls,
            "records_stored": self.records,
            "records_not_stored": self.record_errors,
            "error": self.error,
            "failed_at": self.failed_at,
            "catalogue_days_cached": sorted(self._catalogue),
        }

    @staticmethod
    def _write_certs(cert_pem: str, key_pem: str) -> tuple[str, tuple[str, str]]:
        folder = tempfile.mkdtemp(prefix="fb13-betfair-")
        os.chmod(folder, 0o700)
        paths = (os.path.join(folder, "client.crt"), os.path.join(folder, "client.key"))
        for path, content in zip(paths, (cert_pem, key_pem)):
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(content if content.endswith("\n") else content + "\n")
        return folder, paths

    def login(self, by: str | None) -> dict[str, Any]:
        """Once. A second call while logged in is a no-op; after a failure it is refused, not retried."""
        with self._lock:
            if self.logged_in:
                return self.view()
            if self.state == "failed":
                raise BetfairRefused(409, f"a Betfair login failed at {self.failed_at}: {self.error}. Not retried. An operator may clear this with betfair-reset.")
            self.login_attempts += 1
            started = time.monotonic()
            folder: str | None = None
            client = None
            try:
                username = self._credential("betfair_username")
                password = self._credential("betfair_password")
                app_key = self._credential("betfair_app_key")
                folder, cert_files = self._write_certs(self._credential("betfair_cert_pem"), self._credential("betfair_key_pem"))
                client = self._factory(username, password, app_key, cert_files)
                client.login()
                self._client = client
                self.state = "logged_in"
                self.logged_in_at = now_iso()
                self.error, self.failed_at = None, None
            except Exception as exc:  # noqa: BLE001 - every failure latches, none is retried
                self.state = "failed"
                self.failed_at = now_iso()
                self.error = f"{type(exc).__name__}: {scrub(exc)}"
                self._record("login", by, {"endpoint": "identitysso-cert", "key": "delayed"}, {"status": "FAILED", "error": self.error}, (time.monotonic() - started) * 1000, http_trail(client))
                self.activity.record("betfair_login_failed", by, error=self.error, attempt=self.login_attempts)
                log.error("betfair login failed: %s", self.error, extra={"event": "betfair_login_failed", "by": by})
                raise BetfairRefused(424, f"Betfair login failed: {self.error}. Not retried.") from exc
            finally:
                if folder:
                    shutil.rmtree(folder, ignore_errors=True)
            self._record("login", by, {"endpoint": "identitysso-cert", "key": "delayed"}, {"status": "SUCCESS"}, (time.monotonic() - started) * 1000, http_trail(client))
            self.activity.record("betfair_login", by, key="delayed", attempt=self.login_attempts)
            log.info("betfair logged in", extra={"event": "betfair_login", "by": by})
            return self.view()

    def keep_alive(self) -> dict[str, Any]:
        with self._lock:
            if not self.logged_in:
                return self.view()
            started = time.monotonic()
            try:
                self._client.keep_alive()
                self.last_keepalive_at = now_iso()
                self._record("keepAlive", None, {}, {"status": "SUCCESS"}, (time.monotonic() - started) * 1000, http_trail(self._client))
            except Exception as exc:  # noqa: BLE001
                self.state = "expired"
                self.error = f"{type(exc).__name__}: {scrub(exc)}"
                self._record("keepAlive", None, {}, {"status": "FAILED", "error": self.error}, (time.monotonic() - started) * 1000, http_trail(self._client))
                self.activity.record("betfair_session_expired", None, error=self.error)
                log.error("betfair keepAlive failed: %s", self.error, extra={"event": "betfair_session_expired"})
            return self.view()

    async def keepalive_loop(self) -> None:
        """Runs after a login. Ends on its own when the session is no longer logged in."""
        while True:
            await asyncio.sleep(KEEPALIVE_EVERY_S)
            if not self.logged_in:
                return
            await asyncio.to_thread(self.keep_alive)

    def logout(self, by: str | None) -> dict[str, Any]:
        with self._lock:
            client, self._client = self._client, None
            if client is not None and self.state == "logged_in":
                started = time.monotonic()
                try:
                    client.logout()
                    self._record("logout", by, {}, {"status": "SUCCESS"}, (time.monotonic() - started) * 1000, http_trail(client))
                except Exception as exc:  # noqa: BLE001
                    self._record("logout", by, {}, {"status": "FAILED", "error": f"{type(exc).__name__}: {scrub(exc)}"}, (time.monotonic() - started) * 1000, http_trail(client))
            self.state = "logged_out"
            self.activity.record("betfair_logout", by)
            return self.view()

    def reset(self, by: str | None) -> dict[str, Any]:
        """Clears a failed, expired or logged-out state so an operator may ask for another login. Logs nothing in."""
        with self._lock:
            before = self.state
            if self.state in ("failed", "expired", "logged_out"):
                self._client = None
                self.state = "none"
                self.error, self.failed_at = None, None
            self.activity.record("betfair_reset", by, before=before, after=self.state)
            return self.view()

    # ---- read only --------------------------------------------------------

    def markets(self, day: date, by: str | None, max_age_s: float = CATALOGUE_FRESH_S) -> dict[str, Any]:
        """The day's GB and IE WIN markets with their runners, from a fresh cache or from Betfair."""
        key = day.isoformat()
        cached = self._catalogue.get(key)
        if cached and time.monotonic() - cached[0] < max_age_s:
            return {"date": key, "from_cache": True, "fetched_at": cached[2], "markets": list(cached[1])}
        with self._lock:
            if not self.logged_in:
                raise BetfairRefused(409, f"not logged in to Betfair (session: {self.state}). An operator logs in with betfair-login; nothing logs in by itself.")
            from betfairlightweight import filters

            start, end = london_day_window(day)
            market_filter = filters.market_filter(
                event_type_ids=[EVENT_TYPE_HORSE_RACING],
                market_countries=COUNTRIES,
                market_type_codes=MARKET_TYPES,
                market_start_time=filters.time_range(from_=iso_z(start), to=iso_z(end)),
            )
            request = {"operation": "listMarketCatalogue", "filter": market_filter, "marketProjection": MARKET_PROJECTION, "sort": "FIRST_TO_START", "maxResults": MAX_MARKETS}
            started = time.monotonic()
            try:
                raw = self._client.betting.list_market_catalogue(
                    filter=market_filter, market_projection=MARKET_PROJECTION, sort="FIRST_TO_START", max_results=MAX_MARKETS, lightweight=True
                )
            except Exception as exc:  # noqa: BLE001
                err = f"{type(exc).__name__}: {scrub(exc)}"
                self._record("listMarketCatalogue", by, request, {"status": "FAILED", "error": err}, (time.monotonic() - started) * 1000, http_trail(self._client))
                if "SESSION" in err.upper():
                    self.state = "expired"
                    self.error = err
                    self.activity.record("betfair_session_expired", by, error=err)
                raise BetfairRefused(424, f"listMarketCatalogue failed: {err}") from exc
            self.calls += 1
            self.last_call_at = now_iso()
            markets = [simplify(m) for m in (raw or [])]
            fetched_at = now_iso()
            self._record("listMarketCatalogue", by, request, {"status": "SUCCESS", "count": len(markets), "markets": raw}, (time.monotonic() - started) * 1000, http_trail(self._client))
            self.activity.record("betfair_catalogue", by, date=key, **summarise(markets))
            self._catalogue[key] = (time.monotonic(), markets, fetched_at)
            return {"date": key, "from_cache": False, "fetched_at": fetched_at, "markets": list(markets)}

    # ---- orders (step 3) ------------------------------------------------------
    # Sent only when app/orders.py says so. Every call and its answer is recorded whatever happens.

    def _order_call(self, operation: str, by: str | None, request: dict[str, Any], call: Callable[[], Any]) -> dict[str, Any]:
        with self._lock:
            if not self.logged_in:
                raise BetfairRefused(409, f"not logged in to Betfair (session: {self.state}); nothing is sent")
            started = time.monotonic()
            try:
                raw = call()
            except Exception as exc:  # noqa: BLE001
                err = f"{type(exc).__name__}: {scrub(exc)}"
                self._record(operation, by, request, {"status": "FAILED", "error": err}, (time.monotonic() - started) * 1000, http_trail(self._client))
                if "SESSION" in err.upper():
                    self.state = "expired"
                    self.error = err
                    self.activity.record("betfair_session_expired", by, error=err)
                log.error("betfair %s failed: %s", operation, err, extra={"event": "betfair_order_call_failed", "by": by})
                raise BetfairRefused(424, f"{operation} failed: {err}") from exc
            self.order_calls += 1
            self.last_call_at = now_iso()
            body = raw if isinstance(raw, dict) else {"body": raw}
            self._record(operation, by, request, {"status": "RETURNED", "body": body}, (time.monotonic() - started) * 1000, http_trail(self._client))
            return body

    def place_orders(self, request: dict[str, Any], by: str | None) -> dict[str, Any]:
        """placeOrders with the exact body orders.py built. Returns Betfair's report as it came."""
        return self._order_call(
            "placeOrders",
            by,
            request,
            lambda: self._client.betting.place_orders(
                market_id=request["marketId"],
                instructions=request["instructions"],
                customer_ref=request.get("customerRef"),
                customer_strategy_ref=request.get("customerStrategyRef"),
                lightweight=True,
            ),
        )

    def cancel_orders(self, market_id: str, instructions: list[dict[str, Any]], customer_ref: str | None, by: str | None) -> dict[str, Any]:
        request = {"marketId": market_id, "instructions": instructions, "customerRef": customer_ref}
        return self._order_call(
            "cancelOrders",
            by,
            request,
            lambda: self._client.betting.cancel_orders(market_id=market_id, instructions=instructions, customer_ref=customer_ref, lightweight=True),
        )

    def current_orders(self, by: str | None, bet_ids: list[str] | None = None, customer_strategy_refs: list[str] | None = None) -> dict[str, Any]:
        request = {"betIds": bet_ids, "customerStrategyRefs": customer_strategy_refs, "orderProjection": "ALL"}
        return self._order_call(
            "listCurrentOrders",
            by,
            request,
            lambda: self._client.betting.list_current_orders(bet_ids=bet_ids, customer_strategy_refs=customer_strategy_refs, order_projection="ALL", lightweight=True),
        )

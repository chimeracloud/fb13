"""The activity log: what this unit did, who asked, when. Append-only.

Each event is one object in the config bucket, under the UTC day it happened:

    gs://chiops-fb13-config/activity/{YYYY-MM-DD}/{ms}-{id}.json

and also kept in a ring in memory for GET /admin/activity and pushed to the
server-sent-events subscribers of GET /admin/events. A new instance reloads
the newest stored events of today and yesterday at start, so the log on
screen does not go blank at a restart.

Events carry no credential and no token. The storage write failing never
stops the action that caused the event; it is counted and logged.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any

from app.storage import Store

log = logging.getLogger(__name__)

PREFIX = "activity/"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class Activity:
    def __init__(self, store: Store, ring: int = 200) -> None:
        self.store = store
        self._ring: deque[dict[str, Any]] = deque(maxlen=ring)
        self._subscribers: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock = threading.Lock()
        self.recorded = 0
        self.store_errors = 0
        self.last_store_error: str | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def record(self, event: str, by: str | None = None, **detail: Any) -> dict[str, Any]:
        ev: dict[str, Any] = {"id": uuid.uuid4().hex[:12], "at": now_iso(), "event": event, "by": by, "detail": detail}
        try:
            ev["stored_as"] = self.store.put(f"{PREFIX}{ev['at'][:10]}/", ev)
        except Exception as exc:  # noqa: BLE001
            ev["stored_as"] = None
            self.store_errors += 1
            self.last_store_error = f"{type(exc).__name__}: {exc}"
            log.error("activity not stored: %s", self.last_store_error, extra={"event": "activity_store_error"})
        with self._lock:
            self._ring.append(ev)
            self.recorded += 1
            subscribers = list(self._subscribers)
        log.info("activity: %s", event, extra={"event": event, "by": by})
        if self._loop is not None and subscribers:
            for queue in subscribers:
                self._loop.call_soon_threadsafe(self._offer, queue, ev)
        return ev

    @staticmethod
    def _offer(queue: asyncio.Queue, ev: dict[str, Any]) -> None:
        try:
            queue.put_nowait(ev)
        except asyncio.QueueFull:
            pass  # a slow screen loses an event; the store has it

    def recent(self, n: int = 100) -> list[dict[str, Any]]:
        """Newest first."""
        with self._lock:
            return list(reversed(self._ring))[:n]

    def load_recent(self, n: int = 50) -> int:
        """At start: the newest n stored events of today and yesterday (UTC), oldest first into the ring,
        ahead of anything this instance has already recorded. Returns how many were loaded."""
        today = datetime.now(timezone.utc).date()
        names: list[str] = []
        try:
            for day in (today - timedelta(days=1), today):
                names.extend(self.store.names(f"{PREFIX}{day.isoformat()}/"))
        except Exception as exc:  # noqa: BLE001
            self.store_errors += 1
            self.last_store_error = f"{type(exc).__name__}: {exc}"
            log.error("activity not loaded: %s", self.last_store_error, extra={"event": "activity_store_error"})
            return 0
        loaded: list[dict[str, Any]] = []
        for name in names[-n:]:
            try:
                loaded.append(self.store.get(name))
            except Exception as exc:  # noqa: BLE001
                self.store_errors += 1
                self.last_store_error = f"{type(exc).__name__}: {exc}"
        with self._lock:
            own = list(self._ring)
            own_ids = {ev.get("id") for ev in own}
            added = [ev for ev in loaded if ev.get("id") not in own_ids]  # never twice: this instance's own are already here
            self._ring.clear()
            for ev in added:
                self._ring.append(ev)
            for ev in own:
                self._ring.append(ev)
        return len(added)

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        with self._lock:
            self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        with self._lock:
            self._subscribers.discard(queue)

    @property
    def subscribers(self) -> int:
        with self._lock:
            return len(self._subscribers)

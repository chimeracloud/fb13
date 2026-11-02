"""The stored settings: mode, the caps, the kill switch, the operators.

Everything that decides whether an order may go out lives in one JSON object
in the config bucket, and the stored value governs. The defaults in this file
apply only until the first version is stored; a restart hydrates from the
bucket, never from here. (One FSU once started itself on a live Betfair key
because its code default said so. CHI-BRF-004.)

    gs://chiops-fb13-config/settings/v/{ms}-{id}.json    one object per change, create-only, newest wins

Each object is {"values": {...}, "updated_at", "updated_by", "reason", "change", "previous"}.

Two fields have no API path at all: `mode` and `page_access_confirmed`.
Charles changes them, by his own word, by writing a new version to the bucket
(README, "By hand"). The API cannot, whoever is signed in. The kill switch
(`placing_enabled`) changes through POST /admin/control/kill and /resume; the
caps and the operators through PUT /admin/config. Every change is a new
version carrying who, when and why.

Charles's rulings of 2 November 2026: caps are on money at risk, the stake for
a back and the liability for a lay; defaults £5 at risk an order and £10 a
mode a London day; they apply in both modes and are counted separately per
mode. The counting arrives with the order records in step 3; the caps are
stored here from step 1.
"""

from __future__ import annotations

import copy
import logging
import math
import threading
import time
from datetime import datetime, timezone
from typing import Any

from app.storage import Store

log = logging.getLogger(__name__)

PREFIX = "settings/v/"
MODES = ("paper", "real")
CAP_KEYS = ("per_order_at_risk_gbp", "per_day_at_risk_gbp")

DEFAULTS: dict[str, Any] = {
    "schema": 1,
    "mode": "paper",
    "page_access_confirmed": False,
    "placing_enabled": False,
    "caps": {"per_order_at_risk_gbp": 5.0, "per_day_at_risk_gbp": 10.0},
    "operators": [],
}

PROTECTED = ("schema", "mode", "page_access_confirmed")  # no API path: Charles, by hand, by his own word
API_SETTABLE = ("caps", "operators")  # PUT /admin/config
CONTROL_SETTABLE = ("placing_enabled",)  # POST /admin/control/kill and /resume


class SettingsError(ValueError):
    """A change that cannot be stored, with the reason in words."""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def check_caps(caps: Any) -> dict[str, float]:
    if not isinstance(caps, dict):
        raise SettingsError("caps must be an object with per_order_at_risk_gbp and per_day_at_risk_gbp")
    unknown = sorted(set(caps) - set(CAP_KEYS))
    if unknown:
        raise SettingsError(f"unknown cap(s): {', '.join(unknown)}")
    out: dict[str, float] = {}
    for key in CAP_KEYS:
        if key not in caps:
            raise SettingsError(f"{key} is required")
        value = caps[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise SettingsError(f"{key} must be a number of pounds")
        value = float(value)
        if not math.isfinite(value) or value <= 0:
            raise SettingsError(f"{key} must be more than 0")
        if round(value, 2) != value:
            raise SettingsError(f"{key} must be whole pence")
        out[key] = value
    if out["per_day_at_risk_gbp"] < out["per_order_at_risk_gbp"]:
        raise SettingsError("the day cap cannot be below the order cap")
    return out


def check_operators(operators: Any) -> list[str]:
    if not isinstance(operators, list):
        raise SettingsError("operators must be a list of email addresses")
    out: list[str] = []
    for item in operators:
        if not isinstance(item, str):
            raise SettingsError("each operator must be an email address")
        email = item.strip().lower()
        if len(email) < 3 or len(email) > 254 or " " in email or "@" not in email[1:-1]:
            raise SettingsError(f"not an email address: {item.strip()!r}")
        if email not in out:
            out.append(email)
    return out


def normalise(stored: dict[str, Any] | None) -> tuple[dict[str, Any], list[str]]:
    """The values in force from a stored object, with the defaults filling any gap.

    A stored value that is not valid falls back to the safe default and is
    reported in the second element, never silently: paper, placing disabled,
    the default caps, nobody signed in.
    """
    values = copy.deepcopy(DEFAULTS)
    problems: list[str] = []
    if not stored:
        return values, problems
    v = stored.get("values") if isinstance(stored.get("values"), dict) else stored
    mode = v.get("mode", "paper")
    if mode in MODES:
        values["mode"] = mode
    else:
        problems.append(f"stored mode {mode!r} is neither paper nor real: paper in force")
    for key in ("page_access_confirmed", "placing_enabled"):
        flag = v.get(key, False)
        if isinstance(flag, bool):
            values[key] = flag
        else:
            problems.append(f"stored {key} is not true or false: false in force")
    try:
        values["caps"] = check_caps(v.get("caps", DEFAULTS["caps"]))
    except SettingsError as exc:
        problems.append(f"stored caps rejected ({exc}): the default caps are in force")
    try:
        values["operators"] = check_operators(v.get("operators", []))
    except SettingsError as exc:
        problems.append(f"stored operators rejected ({exc}): nobody can sign in")
    return values, problems


class Settings:
    def __init__(self, store: Store, ttl_s: float = 5.0) -> None:
        self.store = store
        self.ttl_s = ttl_s
        self.values, self.problems = normalise(None)
        self.source: str | None = None  # the object the values in force came from
        self.updated_at: str | None = None
        self.updated_by: str | None = None
        self.reason: str | None = None
        self.loaded_at: str | None = None
        self.error: str | None = None
        self.versions = 0
        self._loaded_mono = -1e9
        self._lock = threading.RLock()

    # ---- read ------------------------------------------------------------

    def load(self) -> dict[str, Any]:
        """Re-read the newest stored version. Unreadable: the values already in force stand
        (the defaults, if nothing was ever read) and the error is shown."""
        with self._lock:
            try:
                names = self.store.names(PREFIX)
                stored = self.store.get(names[-1]) if names else None
                self.values, self.problems = normalise(stored)
                self.versions = len(names)
                self.source = names[-1] if names else None
                meta = stored if isinstance(stored, dict) else {}
                self.updated_at = meta.get("updated_at")
                self.updated_by = meta.get("updated_by")
                self.reason = meta.get("reason")
                self.error = None
                self.loaded_at = now_iso()
                for problem in self.problems:
                    log.warning(problem, extra={"event": "settings_problem"})
            except Exception as exc:  # noqa: BLE001 - every failure is reported, none is fatal
                self.error = f"could not read the settings: {type(exc).__name__}: {exc}"
                log.exception("settings unreadable: the values already in force stand")
            self._loaded_mono = time.monotonic()
            return self.view()

    def current(self) -> dict[str, Any]:
        """The values in force, re-read when older than ttl_s."""
        if time.monotonic() - self._loaded_mono >= self.ttl_s:
            self.load()
        with self._lock:
            return copy.deepcopy(self.values)

    @property
    def real_allowed(self) -> bool:
        return self.values["mode"] == "real" and self.values["page_access_confirmed"] is True

    def placing_allowed(self, mode: str) -> tuple[bool, str]:
        """Asked before any order is built (step 3). (allowed, the reason in words)."""
        v = self.values
        if not v["placing_enabled"]:
            return False, "placing is disabled: the kill switch is on"
        if mode == "paper":
            return True, "paper: the order is built and recorded, nothing is sent"
        if mode != "real":
            return False, f"unknown mode {mode!r}"
        if v["mode"] != "real":
            return False, "the stored settings say paper"
        if not v["page_access_confirmed"]:
            return False, "Charles has not confirmed that Cloudflare Access covers the page"
        return True, "real"

    # ---- write -----------------------------------------------------------

    def _write(self, new_values: dict[str, Any], by: str, reason: str | None, change: str) -> dict[str, Any]:
        now = now_iso()
        record = {
            "values": new_values,
            "updated_at": now,
            "updated_by": by,
            "reason": reason,
            "change": change,
            "previous": self.source,
        }
        name = self.store.put(PREFIX, record)  # raises: nothing is applied that was not stored
        with self._lock:
            self.values = copy.deepcopy(new_values)
            self.source = name
            self.updated_at, self.updated_by, self.reason = now, by, reason
            self.problems, self.error = [], None
            self.versions += 1
            self._loaded_mono = time.monotonic()
        log.info("settings %s by %s", change, by, extra={"event": f"settings_{change}", "by": by})
        return self.view()

    def put(self, changes: dict[str, Any], by: str, reason: str | None = None) -> dict[str, Any]:
        """PUT /admin/config: the caps and the operators, nothing else."""
        if not isinstance(changes, dict) or not changes:
            raise SettingsError("nothing to set")
        unknown = sorted(set(changes) - set(API_SETTABLE))
        if unknown:
            protected = [k for k in unknown if k in PROTECTED or k in CONTROL_SETTABLE]
            if protected:
                raise SettingsError(f"{', '.join(protected)}: not settable through the API")
            raise SettingsError(f"unknown setting(s): {', '.join(unknown)}")
        self.load()  # start from what is stored now
        new = copy.deepcopy(self.values)
        if "caps" in changes:
            partial = changes["caps"]
            if not isinstance(partial, dict):
                raise SettingsError("caps must be an object")
            new["caps"] = check_caps({**self.values["caps"], **partial})
        if "operators" in changes:
            new["operators"] = check_operators(changes["operators"])
        if new == self.values:
            raise SettingsError("nothing would change")
        return self._write(new, by, reason, "config")

    def set_placing(self, enabled: bool, by: str, reason: str | None = None) -> dict[str, Any]:
        """The kill switch (False) and resume (True). Always stored, even when already so."""
        self.load()
        new = copy.deepcopy(self.values)
        new["placing_enabled"] = bool(enabled)
        return self._write(new, by, reason, "resume" if enabled else "kill")

    # ---- view ------------------------------------------------------------

    def view(self) -> dict[str, Any]:
        with self._lock:
            return {
                "values": copy.deepcopy(self.values),
                "defaults": copy.deepcopy(DEFAULTS),
                "real_allowed": self.real_allowed,
                "api_settable": list(API_SETTABLE),
                "control_settable": list(CONTROL_SETTABLE),
                "protected": list(PROTECTED),
                "stored_at": f"{self.store.location}/{PREFIX}",
                "in_force_from": self.source,
                "versions": self.versions,
                "updated_at": self.updated_at,
                "updated_by": self.updated_by,
                "reason": self.reason,
                "loaded_at": self.loaded_at,
                "problems": list(self.problems),
                "error": self.error,
            }

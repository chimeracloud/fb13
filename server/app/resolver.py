"""A slip line to a Betfair market and runner. Pure functions, no network.

Safety rule 5 (Charles, 1 November 2026): the server maps a slip line to a
market and runner with listMarketCatalogue (horse racing, GB and IE win
markets), matched by start time and venue; the runner name must match
exactly after normalising case and spacing; a missing or ambiguous match is
refused and the line flagged. Nothing here guesses: a near miss is a flag
with the candidates named, so a person can see why.

The slip's race cell is "13:40 Cork": a UK local time and a course. Betfair
gives marketStartTime in UTC and the course as event.venue.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timezone
from typing import Any

from app.betfair import LONDON, parse_betfair_time

RACE = re.compile(r"^\s*(\d{1,2}):(\d{2})\s+(\S.*?)\s*$")


def norm(s: Any) -> str:
    """Case and spacing only: NFC, casefold, one space between words."""
    return " ".join(unicodedata.normalize("NFC", str(s or "")).casefold().split())


def parse_race(cell: Any) -> tuple[int, int, str] | None:
    m = RACE.match(str(cell or ""))
    if not m:
        return None
    hh, mm, venue = int(m.group(1)), int(m.group(2)), m.group(3)
    if hh > 23 or mm > 59:
        return None
    return hh, mm, venue


def start_utc(day: date, hh: int, mm: int) -> datetime:
    """A UK local time on the slip's date, as the UTC instant Betfair would show."""
    return datetime(day.year, day.month, day.day, hh, mm, tzinfo=LONDON).astimezone(timezone.utc)


def resolve_line(day: date, race: Any, horse: Any, markets: list[dict[str, Any]], line_id: str | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"id": line_id, "race": race, "horse": horse, "status": "flagged", "flag": None}
    parsed = parse_race(race)
    if not parsed:
        out["flag"] = "race cell not read: expected a time and a course, as in 13:40 Cork"
        return out
    hh, mm, venue = parsed
    horse_n = norm(horse)
    if not horse_n:
        out["flag"] = "no horse name on the line"
        return out
    at = start_utc(day, hh, mm)
    same_time = [m for m in markets if m.get("start_time") and parse_betfair_time(m["start_time"]) == at]
    venue_n = norm(venue)
    candidates = [m for m in same_time if norm(m.get("venue")) == venue_n]
    if not candidates:
        others = sorted({m.get("venue") or "?" for m in same_time})
        out["flag"] = f"no GB or IE win market at {hh:02d}:{mm:02d} for {venue.strip()}" + (
            f"; at that time Betfair has: {', '.join(others)}" if others else "; Betfair has nothing at that time"
        )
        return out
    if len(candidates) > 1:
        out["flag"] = f"more than one win market at {hh:02d}:{mm:02d} {venue.strip()}: " + ", ".join(m["market_id"] for m in candidates)
        return out
    market = candidates[0]
    runners = [r for r in market.get("runners", []) if norm(r.get("name")) == horse_n]
    if not runners:
        names = ", ".join(r.get("name") or "?" for r in market.get("runners", []))
        out["flag"] = f"runner not in the market {market['market_id']} ({market.get('market_name')}): the market has {names}"
        out["market_id"] = market["market_id"]
        return out
    if len(runners) > 1:
        out["flag"] = f"the runner name appears {len(runners)} times in market {market['market_id']}"
        out["market_id"] = market["market_id"]
        return out
    runner = runners[0]
    out.update(
        {
            "status": "resolved",
            "flag": None,
            "market_id": market["market_id"],
            "market_name": market.get("market_name"),
            "start_time": market.get("start_time"),
            "start_london": market.get("start_london"),
            "venue": market.get("venue"),
            "selection_id": runner.get("selection_id"),
            "runner_name": runner.get("name"),
            "sort_priority": runner.get("sort_priority"),
            "handicap": runner.get("handicap", 0),
        }
    )
    return out


def resolve_lines(day: date, lines: list[dict[str, Any]], markets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [resolve_line(day, line.get("race"), line.get("horse"), markets, line.get("id")) for line in lines]

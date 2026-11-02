"""The pure resolver. The slip cells here are real, from the third real paste (1 November 2026,
the 08:00 slip). The markets are the first real catalogue, 2 November 2026, read back from the
orders bucket (fixtures/catalogue-2026-11-02.json): 30 GB win markets at Plumpton, Southwell,
Wolverhampton and Chelmsford City, 285 runners."""

import json
from datetime import date, datetime, timezone
from pathlib import Path

from app.betfair import simplify
from app.resolver import norm, parse_race, resolve_line, resolve_lines, start_utc

FIXTURE = Path(__file__).parent / "fixtures" / "catalogue-2026-11-02.json"
DAY = date(2026, 11, 2)


def real_markets():
    return [simplify(m) for m in json.loads(FIXTURE.read_text(encoding="utf-8"))["response"]["markets"]]


def test_parse_race_reads_time_and_course():
    assert parse_race("13:40 Cork") == (13, 40, "Cork")
    assert parse_race(" 12:10  Huntingdon ") == (12, 10, "Huntingdon")
    assert parse_race("15:05 Market Rasen") == (15, 5, "Market Rasen")
    assert parse_race("Cork 13:40") is None
    assert parse_race("25:00 Cork") is None
    assert parse_race("") is None and parse_race(None) is None


def test_norm_is_case_and_spacing_only():
    assert norm("  West   Away ") == "west away"
    assert norm("CHOCTAW NATION") == "choctaw nation"
    assert norm("Thread Of Gold") == norm("thread of gold")
    assert norm("D'Artagnan") != norm("D’Artagnan")  # a different apostrophe is a different name: flagged, not guessed


def test_start_utc_follows_the_london_clock():
    assert start_utc(date(2026, 11, 1), 13, 40) == datetime(2026, 11, 1, 13, 40, tzinfo=timezone.utc)  # GMT
    assert start_utc(date(2026, 10, 24), 13, 40) == datetime(2026, 10, 24, 12, 40, tzinfo=timezone.utc)  # BST


def test_a_line_with_no_market_at_that_time_is_flagged_not_guessed():
    r = resolve_line(date(2026, 11, 1), "13:40 Cork", "West Away", [], line_id="ln_1")
    assert r["status"] == "flagged" and r["id"] == "ln_1"
    assert r["flag"] == "no GB or IE win market at 13:40 for Cork; Betfair has nothing at that time"
    assert "market_id" not in r


def test_bad_cells_are_flagged():
    assert resolve_line(date(2026, 11, 1), "Cork", "West Away", [])["flag"].startswith("race cell not read")
    assert resolve_line(date(2026, 11, 1), "13:40 Cork", "   ", [])["flag"] == "no horse name on the line"


def test_resolve_lines_keeps_order_and_ids():
    out = resolve_lines(date(2026, 11, 1), [{"id": "a", "race": "13:40 Cork", "horse": "West Away"}, {"id": "b", "race": "x", "horse": "y"}], [])
    assert [r["id"] for r in out] == ["a", "b"]
    assert all(r["status"] == "flagged" for r in out)


# ---- against the real catalogue of 2 November 2026 ----------------------------------------


def test_the_real_catalogue_is_what_was_stored():
    ms = real_markets()
    assert len(ms) == 30 and sum(len(m["runners"]) for m in ms) == 285
    assert sorted({m["venue"] for m in ms}) == ["Chelmsford City", "Plumpton", "Southwell", "Wolverhampton"]
    assert ms[0]["start_london"] == "13:00" and ms[0]["venue"] == "Plumpton" and ms[-1]["start_london"] == "20:30" and ms[-1]["venue"] == "Wolverhampton"


def test_a_real_line_resolves_to_its_market_and_runner():
    r = resolve_line(DAY, "13:00 Plumpton", "Hard Stare", real_markets(), "a")
    assert r["status"] == "resolved" and r["flag"] is None and r["id"] == "a"
    assert r["market_id"] == "1.264841544" and r["market_name"] == "3m2f Nov Hcap Chs" and r["venue"] == "Plumpton"
    assert r["selection_id"] == 81578849 and r["runner_name"] == "Hard Stare" and r["sort_priority"] == 1 and r["handicap"] == 0.0
    assert r["start_time"] == "2026-11-02T13:00:00.000Z" and r["start_london"] == "13:00"
    # case and spacing only
    same = resolve_line(DAY, " 13:00   PLUMPTON ", "hard  stare", real_markets())
    assert same["status"] == "resolved" and same["selection_id"] == 81578849


def test_every_real_market_resolves_from_its_own_time_venue_and_first_runner():
    ms = real_markets()
    lines = [{"id": m["market_id"], "race": f"{m['start_london']} {m['venue']}", "horse": m["runners"][0]["name"]} for m in ms]
    out = resolve_lines(DAY, lines, ms)
    assert [r["status"] for r in out] == ["resolved"] * 30
    assert [r["market_id"] for r in out] == [m["market_id"] for m in ms]
    assert [r["selection_id"] for r in out] == [m["runners"][0]["selection_id"] for m in ms]


def test_real_misses_are_flagged_with_the_reason_and_the_candidates():
    ms = real_markets()
    r = resolve_line(DAY, "13:00 Southwell", "Hard Stare", ms)
    assert r["status"] == "flagged" and r["flag"] == "no GB or IE win market at 13:00 for Southwell; at that time Betfair has: Plumpton"
    r = resolve_line(DAY, "13:00 Plumpton", "Hard Stair", ms)
    assert r["flag"] == "runner not in the market 1.264841544 (3m2f Nov Hcap Chs): the market has Hard Stare, Tom Taggle, Could Be You, Lancier Des Obeaux"
    assert r["market_id"] == "1.264841544" and "selection_id" not in r
    r = resolve_line(DAY, "13:05 Plumpton", "Hard Stare", ms)
    assert r["flag"] == "no GB or IE win market at 13:05 for Plumpton; Betfair has nothing at that time"


def test_a_venue_the_slip_may_shorten_is_flagged_not_guessed():
    """Betfair's venue is "Chelmsford City". A slip saying "Chelmsford" is a flag with the venue named,
    so a person sees it; the resolver does not guess. Known risk until a real slip shows what Mark writes."""
    r = resolve_line(DAY, "16:45 Chelmsford", "x", real_markets())
    assert r["status"] == "flagged" and r["flag"] == "no GB or IE win market at 16:45 for Chelmsford; at that time Betfair has: Chelmsford City"

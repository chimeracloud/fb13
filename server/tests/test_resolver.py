"""The pure resolver. The slip cells here are real, from the third real paste (1 November 2026,
the 08:00 slip). The market lists are empty until the first real catalogue is stored: matching
against real markets is tested then, with real lines."""

from datetime import date, datetime, timezone

from app.resolver import norm, parse_race, resolve_line, resolve_lines, start_utc


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

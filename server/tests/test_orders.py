"""Step 3: the order builder, the paper ledger, the real path, the test order.

The markets are the real catalogue of 2 November 2026 (server/tests/fixtures/catalogue-2026-11-02.json),
read back from the orders bucket. The lines are built from it: 13:00 Plumpton, Hard Stare, selection
81578849 in market 1.264841544. The stakes and prices are test inputs, stated here, not facts about
anyone's bet. The clock is fixed at 08:30 UTC on 2 November 2026, before the first race.
"""

import json
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import pytest

from app.activity import Activity
from app.betfair import BetfairRefused, simplify
from app.orders import (
    LADDER,
    TEST_CONFIRMATION,
    TEST_STRATEGY_REF,
    OrderRefused,
    Orders,
    customer_order_ref,
    first_number,
    is_tick,
    min_size_ok,
    order_key,
    place_request,
    strategy_ref,
    tick_down,
)
from app.settings import PREFIX, Settings
from app.storage import MemoryStore

FIXTURE = Path(__file__).parent / "fixtures" / "catalogue-2026-11-02.json"
DAY = date(2026, 11, 2)
NOW = datetime(2026, 11, 2, 8, 30, tzinfo=timezone.utc)
OPERATOR = "x@y.z"
D = Decimal


def markets():
    raw = json.loads(FIXTURE.read_text(encoding="utf-8"))["response"]["markets"]
    return [simplify(m) for m in raw]


def line(race="13:00 Plumpton", horse="Hard Stare", lay_target="1.75 (5% under)", cap="£125", price="1.67", stake="3", slot="08:00", **extra):
    return {"slot": slot, "line": {"id": "ln_1", "race": race, "horse": horse, "lay_target": lay_target, "betfair_cap": cap}, "back": {"price": price, "stake": stake, "where": "BY"}, **extra}


class FakeBetfair:
    """Stands in for BetfairSession's order calls. Canned answers, every call kept."""

    def __init__(self, logged_in=True):
        self.logged_in, self.state = logged_in, "logged_in" if logged_in else "none"
        self.calls = []
        self.place_response = {"status": "SUCCESS", "marketId": "1.264841544", "customerRef": None, "instructionReports": [{"status": "SUCCESS", "instruction": {}, "betId": "400000000001", "placedDate": "2026-11-02T08:30:01.000Z", "averagePriceMatched": 0.0, "sizeMatched": 0.0, "orderStatus": "EXECUTABLE"}]}
        self.cancel_response = {"status": "SUCCESS", "marketId": "1.264841544", "instructionReports": [{"status": "SUCCESS", "instruction": {"betId": "400000000001"}, "sizeCancelled": 2.0, "cancelledDate": "2026-11-02T08:30:02.000Z"}]}
        self.current_responses = []  # popped in order
        self.place_error = None

    def place_orders(self, request, by):
        self.calls.append(("placeOrders", request))
        if self.place_error:
            raise self.place_error
        return self.place_response

    def cancel_orders(self, market_id, instructions, customer_ref, by):
        self.calls.append(("cancelOrders", {"marketId": market_id, "instructions": instructions, "customerRef": customer_ref}))
        return self.cancel_response

    def current_orders(self, by, bet_ids=None, customer_strategy_refs=None):
        self.calls.append(("listCurrentOrders", {"betIds": bet_ids, "customerStrategyRefs": customer_strategy_refs}))
        return self.current_responses.pop(0) if self.current_responses else {"currentOrders": [], "moreAvailable": False}


def make(values, logged_in=True):
    config, orders_store = MemoryStore(), MemoryStore()
    config.put(PREFIX, {"values": {"operators": [OPERATOR], **values}, "updated_by": "test"}, 1_000_000_000_000)
    settings = Settings(config)
    settings.load()
    activity = Activity(MemoryStore())
    bf = FakeBetfair(logged_in)
    return Orders(orders_store, settings, activity, bf), orders_store, activity, bf


PAPER = {"mode": "paper", "placing_enabled": True}
REAL = {"mode": "real", "placing_enabled": True, "page_access_confirmed": True}


# ---- pure helpers -------------------------------------------------------------


def test_the_ladder_is_betfairs_and_prices_move_down_to_a_tick():
    assert [(str(a), str(b), str(s)) for a, b, s in LADDER] == [
        ("1.01", "2", "0.01"), ("2", "3", "0.02"), ("3", "4", "0.05"), ("4", "6", "0.1"), ("6", "10", "0.2"),
        ("10", "20", "0.5"), ("20", "30", "1"), ("30", "50", "2"), ("50", "100", "5"), ("100", "1000", "10"),
    ]
    for given, expected in [("1.75", "1.75"), ("2.03", "2.02"), ("2", "2.00"), ("3.33", "3.30"), ("4.15", "4.1"), ("7.7", "7.6"), ("15.3", "15.0"), ("25.5", "25"), ("41", "40"), ("77", "75"), ("995", "990"), ("1000", "1000"), ("1.01", "1.01")]:
        assert tick_down(D(given)) == D(expected), given
    assert tick_down(D("1.005")) is None and tick_down(D("1001")) is None and tick_down(D("0")) is None
    assert is_tick(D("2.02")) and not is_tick(D("2.03")) and is_tick(D("1000"))


def test_numbers_are_read_from_the_slips_cells():
    assert first_number("1.75 (5% under)") == D("1.75")
    assert first_number("£125") == D("125")
    assert first_number("2.90 ⚠ check") == D("2.90")
    assert first_number("") is None and first_number(None) is None and first_number("n/a") is None


def test_the_minimum_size_is_two_pounds_for_any_order_by_ruling():
    ok, why = min_size_ok(D("2.86"))
    assert ok and "at or above the minimum of 2.00" in why
    ok, why = min_size_ok(D("2.00"))
    assert ok
    ok, why = min_size_ok(D("1.99"))
    assert not ok and why == "size 1.99 is below the minimum of 2.00 an order (Charles's ruling of 2 November 2026, whatever Betfair's currency table says)"
    ok, why = min_size_ok(D("0.50"))  # Betfair's payout rule would allow this at a long price; the ruling does not
    assert not ok


def test_references_name_fb13_the_date_the_slot_and_the_line():
    key = order_key(DAY, "08:00", " 13:00  Plumpton", "HARD STARE")
    assert key == "2026-11-02|08:00|13:00 plumpton|hard stare" == order_key(DAY, "08:00", "13:00 Plumpton", "hard stare")
    ref = customer_order_ref(key, DAY, "08:00")
    assert ref.startswith("FB13-20261102-0800-") and len(ref) == 31 and ref.replace("-", "").isalnum()
    assert strategy_ref("08:00") == "FB13-0800" and len(TEST_STRATEGY_REF) <= 15
    body = place_request("1.264841544", 81578849, "LAY", D("1.75"), D("2.86"), ref, "FB13-0800")
    assert body == {
        "marketId": "1.264841544",
        "instructions": [{"orderType": "LIMIT", "selectionId": 81578849, "handicap": 0, "side": "LAY", "limitOrder": {"size": 2.86, "price": 1.75, "persistenceType": "LAPSE"}, "customerOrderRef": ref}],
        "customerRef": ref,
        "customerStrategyRef": "FB13-0800",
    }


# ---- build ---------------------------------------------------------------------


def test_build_lays_the_real_runner_at_the_tick_below_the_target_with_the_ruled_size():
    orders, store, activity, bf = make(PAPER)
    o = orders.build(line(), DAY, markets(), NOW)
    assert o["status"] == "ok" and o["refusals"] == [] and o["mode"] == "paper"
    assert o["market_id"] == "1.264841544" and o["selection_id"] == 81578849 and o["runner_name"] == "Hard Stare"
    assert o["venue"] == "Plumpton" and o["start_london"] == "13:00" and o["market_name"] == "3m2f Nov Hcap Chs"
    assert o["side"] == "LAY" and o["persistence"] == "LAPSE" and o["price"] == "1.75"
    assert o["size"] == "2.86"  # 3 x 1.67 / 1.75 = 2.8628..., down to the penny
    assert o["liability"] == "2.15" == o["at_risk"]  # 2.86 x 0.75 = 2.145
    assert o["caps"] == {"per_order_at_risk_gbp": "5.00", "per_day_at_risk_gbp": "10.00", "day_so_far": "0.00"}
    assert o["customer_strategy_ref"] == "FB13-0800" and o["customer_order_ref"].startswith("FB13-20261102-0800-")
    assert o["request"]["instructions"][0]["limitOrder"] == {"size": 2.86, "price": 1.75, "persistenceType": "LAPSE"}
    assert o["request"]["instructions"][0]["selectionId"] == 81578849 and o["request"]["customerStrategyRef"] == "FB13-0800"
    assert len(o["ticket"]) == 16
    assert store.names("orders/") == [] and bf.calls == []  # a build stores nothing and sends nothing


def test_build_moves_the_target_down_never_up():
    orders, *_ = make(PAPER)
    o = orders.build(line(lay_target="2.03 (13% under)", price="2.10", stake="2"), DAY, markets(), NOW)
    assert o["lay_target"] == "2.03" and o["price"] == "2.02" and o["status"] == "ok"
    assert o["size"] == "2.07" and o["liability"] == "2.11"  # 2 x 2.10 / 2.02 = 2.0792 -> 2.07; 2.07 x 1.02 = 2.1114 -> 2.11


def test_build_names_every_reason_it_would_refuse():
    orders, *_ = make(PAPER)
    o = orders.build(line(stake="50"), DAY, markets(), NOW)
    assert o["status"] == "refused" and o["refusals"] == ["liability 35.78 is above the per-order cap of 5.00 at risk"]
    assert o["size"] == "47.71" and o["ticket"] is not None  # still shown, so the person sees what was refused
    o = orders.build(line(horse="Hard Stair"), DAY, markets(), NOW)
    assert o["status"] == "refused" and o["refusals"][0].startswith("not resolved: runner not in the market 1.264841544")
    o = orders.build(line(lay_target="1.005"), DAY, markets(), NOW)
    assert "lay target 1.005 is outside Betfair's prices 1.01 to 1000" in o["refusals"]
    o = orders.build(line(lay_target="soon"), DAY, markets(), NOW)
    assert any(r.startswith("lay target not read as a price") for r in o["refusals"])
    o = orders.build(line(price="evens", stake="-1"), DAY, markets(), NOW)
    assert any(r.startswith("back price not read") for r in o["refusals"]) and any(r.startswith("back stake not read") for r in o["refusals"])
    o = orders.build(line(cap="£2"), DAY, markets(), NOW)
    assert o["refusals"] == [
        "size 2.86 is above the slip's Betfair cap of 2 for the course, read as a cap on the lay's size; "
        "that reading is an assumption until the handover with Mark (Claude Strategy reads the cap as the Betfair BACK stake at a course)"
    ]
    o = orders.build(line(cap="n/a"), DAY, markets(), NOW)
    assert "Betfair cap not read as an amount: 'n/a'" in o["refusals"]
    o = orders.build(line(stake="0.5"), DAY, markets(), NOW)
    assert o["refusals"] == ["size 0.47 is below the minimum of 2.00 an order (Charles's ruling of 2 November 2026, whatever Betfair's currency table says)"]
    o = orders.build(line(stake="2"), DAY, markets(), NOW)  # 2 x 1.67 / 1.75 = 1.90: a stake of 2 is too small to lay at these prices
    assert o["refusals"] == ["size 1.90 is below the minimum of 2.00 an order (Charles's ruling of 2 November 2026, whatever Betfair's currency table says)"]
    o = orders.build(line(stake="3"), DAY, markets(), NOW)  # Charles's ruling 7: about 3 at the slip's prices gives a lay of at least 2.00 under 5.00 at risk
    assert o["status"] == "ok" and o["size"] == "2.86" and o["liability"] == "2.15"
    late = datetime(2026, 11, 2, 13, 0, tzinfo=timezone.utc)
    o = orders.build(line(), DAY, markets(), late)
    assert o["refusals"] == ["the race started at 13:00 UK; nothing is laid in play"]


def test_the_kill_switch_and_the_stored_mode_govern_the_build():
    orders, *_ = make({"mode": "paper", "placing_enabled": False})
    o = orders.build(line(), DAY, markets(), NOW)
    assert o["refusals"] == ["placing is disabled: the kill switch is on"]
    orders, *_ = make({"mode": "real", "placing_enabled": True, "page_access_confirmed": False})
    o = orders.build(line(), DAY, markets(), NOW)
    assert o["mode"] == "real" and o["refusals"] == ["Charles has not confirmed that Cloudflare Access covers the page"]


# ---- paper place, cancel, current ---------------------------------------------------


def test_paper_place_records_the_exact_order_and_sends_nothing():
    orders, store, activity, bf = make(PAPER)
    o = orders.build(line(), DAY, markets(), NOW)
    rec = orders.place(line(ticket=o["ticket"], reason="paper trial"), DAY, markets(), OPERATOR, NOW)
    assert rec["event"] == "placed" and rec["mode"] == "paper" and rec["sent"] is False and rec["bet_id"] is None
    assert rec["order"]["request"] == o["request"] and rec["at_risk"] == "2.15" and rec["by"] == OPERATOR
    assert bf.calls == []  # nothing left the server
    names = store.names("orders/2026-11-02/")
    assert len(names) == 1 and store.get(names[0])["event"] == "placed"
    assert activity.recent()[0]["event"] == "order_placed" and activity.recent()[0]["detail"]["sent"] is False
    view = orders.view(DAY)
    assert view["at_risk"] == {"paper": "2.15", "real": "0.00"} and view["mode"] == "paper" and len(view["records"]) == 1
    cur = orders.current(DAY, OPERATOR)
    assert cur["sent"] is False and len(cur["orders"]) == 1 and cur["orders"][0]["status"] == "PAPER" and cur["orders"][0]["priceSize"] == {"price": "1.75", "size": "2.86"}


def test_a_line_is_never_placed_twice_and_the_day_cap_holds():
    orders, store, *_ = make(PAPER)
    o = orders.build(line(), DAY, markets(), NOW)
    orders.place(line(ticket=o["ticket"]), DAY, markets(), OPERATOR, NOW)
    with pytest.raises(OrderRefused) as exc:
        orders.place(line(ticket=o["ticket"]), DAY, markets(), OPERATOR, NOW)
    assert exc.value.status == 409 and "already has a paper order today; a line is never placed twice" in exc.value.detail
    # the same horse typed differently is the same line
    o2 = orders.build(line(race="13:00  PLUMPTON", horse="hard stare"), DAY, markets(), NOW)
    assert "this line already has a paper order today; a line is never placed twice" in o2["refusals"]
    # another runner, liability 4.x each, until the day's 10.00 is reached
    second = orders.build(line(horse="Tom Taggle", stake="6"), DAY, markets(), NOW)  # 6 x 1.67 / 1.75 = 5.72; x 0.75 = 4.29
    assert second["status"] == "ok" and second["liability"] == "4.29"
    orders.place(line(horse="Tom Taggle", stake="6", ticket=second["ticket"]), DAY, markets(), OPERATOR, NOW)
    third = orders.build(line(horse="Could Be You", stake="6"), DAY, markets(), NOW)
    assert third["refusals"] == ["the day's paper money at risk would be 10.73, above the per-day cap of 10.00"]
    refused = [r for r in store.names("orders/2026-11-02/")]
    assert len(refused) == 3  # two placed, one refused, all recorded
    events = [store.get(n)["event"] for n in refused]
    assert events == ["placed", "refused", "placed"]


def test_place_refuses_a_ticket_that_is_not_the_order_built_now():
    orders, *_ = make(PAPER)
    with pytest.raises(OrderRefused) as exc:
        orders.place(line(ticket="0123456789abcdef"), DAY, markets(), OPERATOR, NOW)
    assert exc.value.status == 409 and "is not the one confirmed" in exc.value.detail


def test_paper_cancel_is_a_separate_deliberate_call():
    orders, store, activity, bf = make(PAPER)
    o = orders.build(line(), DAY, markets(), NOW)
    rec = orders.place(line(ticket=o["ticket"]), DAY, markets(), OPERATOR, NOW)
    out = orders.cancel(rec["order_ref"], "changed my mind", OPERATOR, DAY)
    assert out["event"] == "cancelled" and out["sent"] is False and out["reason"] == "changed my mind"
    assert orders.current(DAY, OPERATOR)["orders"] == []
    assert orders.day_at_risk(orders.ledger(DAY), "paper") == D("2.15")  # cancelled or not, it counts for the day
    with pytest.raises(OrderRefused) as exc:
        orders.cancel(rec["order_ref"], None, OPERATOR, DAY)
    assert exc.value.status == 409 and "already cancelled" in exc.value.detail
    with pytest.raises(OrderRefused) as exc:
        orders.cancel("FB13-20261102-0800-000000000000", None, OPERATOR, DAY)
    assert exc.value.status == 404
    assert bf.calls == []


# ---- real place and cancel, with a fake Betfair --------------------------------------


def test_real_place_sends_the_exact_order_and_records_betfairs_answer():
    orders, store, activity, bf = make(REAL)
    o = orders.build(line(), DAY, markets(), NOW)
    assert o["mode"] == "real" and o["status"] == "ok"
    rec = orders.place(line(ticket=o["ticket"]), DAY, markets(), OPERATOR, NOW)
    assert rec["sent"] is True and rec["bet_id"] == "400000000001" and rec["order_status"] == "EXECUTABLE"
    assert bf.calls == [("placeOrders", o["request"])]
    out = orders.cancel(rec["order_ref"], "test", OPERATOR, DAY)
    assert out["sent"] is True and out["size_cancelled"] == 2.0
    assert bf.calls[1] == ("cancelOrders", {"marketId": "1.264841544", "instructions": [{"betId": "400000000001"}], "customerRef": rec["order_ref"]})
    bf.current_responses = [{"currentOrders": [{"betId": "400000000001", "status": "EXECUTABLE"}], "moreAvailable": False}]
    cur = orders.current(DAY, OPERATOR)
    assert cur["sent"] is True and cur["orders"][0]["betId"] == "400000000001"
    assert bf.calls[2] == ("listCurrentOrders", {"betIds": None, "customerStrategyRefs": ["FB13-0800", "FB13-0900", "FB13-1000", "FB13-TEST"]})


def test_real_place_that_betfair_refuses_is_recorded_and_not_counted():
    orders, store, *_ , bf = make(REAL)
    bf.place_response = {"status": "FAILURE", "errorCode": "BET_ACTION_ERROR", "instructionReports": [{"status": "FAILURE", "errorCode": "INVALID_ODDS", "instruction": {}}]}
    o = orders.build(line(), DAY, markets(), NOW)
    with pytest.raises(OrderRefused) as exc:
        orders.place(line(ticket=o["ticket"]), DAY, markets(), OPERATOR, NOW)
    assert exc.value.status == 424 and "INVALID_ODDS" in exc.value.detail
    recs = [store.get(n) for n in store.names("orders/")]
    assert recs[0]["event"] == "place_failed" and recs[0]["betfair"]["errorCode"] == "BET_ACTION_ERROR"
    assert orders.day_at_risk(recs, "real") == D("0.00")
    bf.place_error = BetfairRefused(424, "placeOrders failed: APIError: timeout")
    with pytest.raises(OrderRefused) as exc:
        orders.place(line(horse="Tom Taggle", ticket=orders.build(line(horse="Tom Taggle"), DAY, markets(), NOW)["ticket"]), DAY, markets(), OPERATOR, NOW)
    assert "timeout" in exc.value.detail


# ---- the test order -----------------------------------------------------------------


def test_the_test_order_runs_only_in_real_mode_with_the_sentence_typed():
    orders, *_ = make(PAPER)
    with pytest.raises(OrderRefused) as exc:
        orders.test_order("1.264841544", 81578849, TEST_CONFIRMATION, OPERATOR, DAY, markets(), NOW)
    assert exc.value.status == 409 and "the stored settings say paper" in exc.value.detail
    orders, *_ = make({**REAL, "placing_enabled": False})
    with pytest.raises(OrderRefused, match="kill switch"):
        orders.test_order("1.264841544", 81578849, TEST_CONFIRMATION, OPERATOR, DAY, markets(), NOW)
    orders, store, activity, bf = make(REAL)
    with pytest.raises(OrderRefused) as exc:
        orders.test_order("1.264841544", 81578849, "yes", OPERATOR, DAY, markets(), NOW)
    assert exc.value.status == 409 and TEST_CONFIRMATION in exc.value.detail
    with pytest.raises(OrderRefused, match="not in today's"):
        orders.test_order("1.999", 81578849, TEST_CONFIRMATION, OPERATOR, DAY, markets(), NOW)
    with pytest.raises(OrderRefused, match="not a runner"):
        orders.test_order("1.264841544", 1, TEST_CONFIRMATION, OPERATOR, DAY, markets(), NOW)
    with pytest.raises(OrderRefused, match="started"):
        orders.test_order("1.264841544", 81578849, TEST_CONFIRMATION, OPERATOR, DAY, markets(), datetime(2026, 11, 2, 13, 0, tzinfo=timezone.utc))
    assert bf.calls == [] and store.names("orders/") == []
    orders, *_ , bf = make(REAL, logged_in=False)
    with pytest.raises(OrderRefused, match="not logged in"):
        orders.test_order("1.264841544", 81578849, TEST_CONFIRMATION, OPERATOR, DAY, markets(), NOW)


def test_the_test_order_places_two_pounds_at_1000_sees_it_cancels_it_and_sees_it_gone():
    orders, store, activity, bf = make(REAL)
    bf.current_responses = [
        {"currentOrders": [{"betId": "400000000001", "status": "EXECUTABLE", "sizeMatched": 0.0, "sizeRemaining": 2.0, "priceSize": {"price": 1000.0, "size": 2.0}, "customerOrderRef": "FB13-TEST-083000", "customerStrategyRef": "FB13-TEST"}], "moreAvailable": False},
        {"currentOrders": [], "moreAvailable": False},
    ]
    rec = orders.test_order("1.264841544", 81578849, TEST_CONFIRMATION, OPERATOR, DAY, markets(), NOW)
    assert rec["event"] == "test_order" and rec["verdict"] == "passed: placed, seen, cancelled, gone" and rec["placed"] is True
    assert rec["order_ref"] == "FB13-TEST-083000" and rec["bet_id"] == "400000000001" and rec["at_risk"] == "2.00"
    assert rec["request"]["instructions"][0]["limitOrder"] == {"size": 2.0, "price": 1000.0, "persistenceType": "LAPSE"}
    assert rec["request"]["instructions"][0]["side"] == "BACK" and rec["request"]["customerStrategyRef"] == "FB13-TEST"
    assert [c[0] for c in bf.calls] == ["placeOrders", "listCurrentOrders", "cancelOrders", "listCurrentOrders"]
    assert bf.calls[1][1]["betIds"] == ["400000000001"] and bf.calls[2][1]["instructions"] == [{"betId": "400000000001"}]
    assert [s["step"] for s in rec["steps"]] == ["placeOrders", "listCurrentOrders", "cancelOrders", "listCurrentOrders"] and all(s["ok"] for s in rec["steps"])
    ledger = orders.ledger(DAY)
    assert orders.day_at_risk(ledger, "real") == D("2.00")  # counts for the real day, never as a line's order
    assert orders.placed_keys(ledger, "real") == set()
    assert activity.recent()[0]["event"] == "test_order" and activity.recent()[0]["detail"]["verdict"].startswith("passed")


def test_the_test_order_reports_a_match_or_a_failed_cancel_loudly():
    orders, store, *_ , bf = make(REAL)
    bf.current_responses = [
        {"currentOrders": [{"betId": "400000000001", "status": "EXECUTABLE", "sizeMatched": 2.0, "sizeRemaining": 0.0}], "moreAvailable": False},
        {"currentOrders": [], "moreAvailable": False},
    ]
    with pytest.raises(OrderRefused) as exc:
        orders.test_order("1.264841544", 81578849, TEST_CONFIRMATION, OPERATOR, DAY, markets(), NOW)
    assert exc.value.status == 424 and "MATCHED" in exc.value.detail
    rec = [store.get(n) for n in store.names("orders/")][-1]
    assert rec["event"] == "test_order" and rec["placed"] is True and rec["verdict"].startswith("failed: MATCHED")
    orders, store, *_ , bf = make(REAL)
    bf.cancel_response = {"status": "FAILURE", "errorCode": "BET_ACTION_ERROR", "instructionReports": [{"status": "FAILURE", "errorCode": "BET_TAKEN_OR_LAPSED", "instruction": {"betId": "400000000001"}}]}
    bf.current_responses = [
        {"currentOrders": [{"betId": "400000000001", "status": "EXECUTABLE", "sizeMatched": 0.0}], "moreAvailable": False},
        {"currentOrders": [{"betId": "400000000001", "status": "EXECUTABLE", "sizeMatched": 0.0}], "moreAvailable": False},
    ]
    with pytest.raises(OrderRefused) as exc:
        orders.test_order("1.264841544", 81578849, TEST_CONFIRMATION, OPERATOR, DAY, markets(), NOW)
    assert "THE ORDER MAY STILL BE OPEN" in exc.value.detail and "STILL EXECUTABLE" in exc.value.detail

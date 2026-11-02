"""Version 1, step 3: the order builder, the ledger, and the calls behind it.

What a Place does (Charles's rulings of 2 November 2026): from a slip line
whose back leg is recorded as Placed, build one LAY limit order on Betfair at
the slip's lay target moved to a valid tick, size = back stake x back price /
lay price, persistence LAPSE, one order per line, never the same line twice.
The money at risk is the lay's liability, size x (price - 1); it must not
pass the per-order cap, and the day's total for the mode must not pass the
per-day cap. Paper and real are counted separately. Paper builds the exact
order, records it, and sends nothing. Real sends it, only when the stored
settings say real, Charles has confirmed Access covers the page, and the kill
switch is off. The mode is the stored settings', never the page's.

Charles's rulings of 2 November 2026 on the builder's choices:
- The lay target is moved DOWN to the nearest valid tick, never above the
  target, so the liability never exceeds what the slip accepted. Approved.
- The slip's "Betfair cap" for the course is read, FOR NOW AND AS AN
  ASSUMPTION, as the most that may be laid at that course in backer's stake
  (the order's size); above it, refuse, and say the refusal rests on this
  reading. Claude Strategy reads Mark's note as a cap on the Betfair BACK
  stake at a course, the excess going to bookmakers, so it may not apply to
  lays at all. Confirmed at the handover with Mark.
- A line counts as placed once a place was recorded for it in that mode on
  that day, cancelled or not; a second ask is refused. Approved.
- The day's money at risk counts every order placed in the mode that day,
  cancelled or not, and the test order's 2.00. Approved.
- The minimum size is 2.00 for any order, whatever Betfair's currency table
  says; below it, refuse in words.
- Nothing is laid once the race has started. Approved.
- The caps stay at 5.00 an order and 10.00 a mode a London day.
- Sizes are rounded down to the penny; liability to the nearest penny.

The test order (Charles, 2 November 2026): one BACK of 2.00 at the maximum
price 1000, which cannot match, placed and then cancelled, each step checked
with listCurrentOrders. Real mode only, and only with the confirmation
sentence typed in words. Its references name it FB13-TEST, so it can never be
mistaken for a line's order; it is never counted as one.

Betfair's price ladder is its published increments (INVALID_ODDS outside
them).
"""

from __future__ import annotations

import hashlib
import logging
import re
import time
from datetime import date, datetime, timezone
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any, Callable

from app.activity import Activity
from app.betfair import BetfairRefused, BetfairSession, now_iso, parse_betfair_time
from app.resolver import norm, resolve_line
from app.settings import Settings
from app.storage import Store

log = logging.getLogger(__name__)

ORDERS_PREFIX = "orders/"
SLOTS = ("08:00", "09:00", "10:00")
PERSISTENCE = "LAPSE"
SIDE_LAY = "LAY"
SIDE_BACK = "BACK"
TEST_STRATEGY_REF = "FB13-TEST"
TEST_SIZE = Decimal("2.00")
TEST_PRICE = Decimal("1000")
TEST_CONFIRMATION = "I confirm the real test order: back 2.00 at 1000"
PENNY = Decimal("0.01")
MIN_SIZE = Decimal("2.00")  # Charles's ruling of 2 November 2026: for any order, whatever Betfair's currency table says

# Betfair's price increments, as published: (from, up to but not including, step). The last band includes 1000.
LADDER = (
    (Decimal("1.01"), Decimal("2"), Decimal("0.01")),
    (Decimal("2"), Decimal("3"), Decimal("0.02")),
    (Decimal("3"), Decimal("4"), Decimal("0.05")),
    (Decimal("4"), Decimal("6"), Decimal("0.1")),
    (Decimal("6"), Decimal("10"), Decimal("0.2")),
    (Decimal("10"), Decimal("20"), Decimal("0.5")),
    (Decimal("20"), Decimal("30"), Decimal("1")),
    (Decimal("30"), Decimal("50"), Decimal("2")),
    (Decimal("50"), Decimal("100"), Decimal("5")),
    (Decimal("100"), Decimal("1000"), Decimal("10")),
)
MIN_PRICE, MAX_PRICE = LADDER[0][0], LADDER[-1][1]

_NUMBER = re.compile(r"-?\d+(?:\.\d+)?")


class OrderRefused(Exception):
    def __init__(self, status: int, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


# ---- pure helpers ------------------------------------------------------------


def tick_down(price: Decimal) -> Decimal | None:
    """The valid Betfair price at or just below `price`; None outside 1.01..1000."""
    if price < MIN_PRICE or price > MAX_PRICE:
        return None
    if price == MAX_PRICE:
        return MAX_PRICE
    for low, high, step in LADDER:
        if low <= price < high:
            steps = ((price - low) / step).to_integral_value(rounding=ROUND_DOWN)
            return (low + steps * step).quantize(step)
    return None


def is_tick(price: Decimal) -> bool:
    return tick_down(price) == price


def first_number(text: Any) -> Decimal | None:
    """The first number in a cell: "1.75 (5% under)" -> 1.75, "£125" -> 125. None if there is none."""
    m = _NUMBER.search(str(text or ""))
    if not m:
        return None
    try:
        return Decimal(m.group(0))
    except InvalidOperation:
        return None


def money(d: Decimal, rounding: str = ROUND_HALF_UP) -> Decimal:
    return d.quantize(PENNY, rounding=rounding)


def min_size_ok(size: Decimal) -> tuple[bool, str]:
    """The minimum is 2.00 for any order, by Charles's ruling, whatever Betfair's currency table says."""
    if size >= MIN_SIZE:
        return True, f"size {size} at or above the minimum of {MIN_SIZE} an order"
    return False, f"size {size} is below the minimum of {MIN_SIZE} an order (Charles's ruling of 2 November 2026, whatever Betfair's currency table says)"


def slot_compact(slot: str) -> str:
    return slot.replace(":", "")


def order_key(day: date, slot: str, race: Any, horse: Any) -> str:
    return f"{day.isoformat()}|{slot}|{norm(race)}|{norm(horse)}"


def customer_order_ref(key: str, day: date, slot: str) -> str:
    """FB13-YYYYMMDD-HHMM-<12 hex of the line>: 31 characters, letters, digits and hyphens only."""
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]
    return f"FB13-{day.strftime('%Y%m%d')}-{slot_compact(slot)}-{digest}"


def strategy_ref(slot: str) -> str:
    """FB13 and the slot, 9 characters (Betfair allows 15)."""
    return f"FB13-{slot_compact(slot)}"


def ticket_for(market_id: str, selection_id: Any, side: str, price: Decimal, size: Decimal) -> str:
    """What the confirm panel showed, in sixteen hex characters. A place must present it; a different build is refused."""
    return hashlib.sha256(f"{market_id}|{selection_id}|{side}|{price}|{size}".encode("utf-8")).hexdigest()[:16]


def place_request(market_id: str, selection_id: Any, side: str, price: Decimal, size: Decimal, order_ref: str, strategy: str) -> dict[str, Any]:
    """The exact placeOrders body, as Betfair takes it (betfairlightweight sends these keys)."""
    return {
        "marketId": market_id,
        "instructions": [
            {
                "orderType": "LIMIT",
                "selectionId": int(selection_id),
                "handicap": 0,
                "side": side,
                "limitOrder": {"size": float(size), "price": float(price), "persistenceType": PERSISTENCE},
                "customerOrderRef": order_ref,
            }
        ],
        "customerRef": order_ref,
        "customerStrategyRef": strategy,
    }


# ---- the builder and the ledger ------------------------------------------------


class Orders:
    def __init__(self, store: Store, settings: Settings, activity: Activity, betfair: BetfairSession) -> None:
        self.store = store
        self.settings = settings
        self.activity = activity
        self.betfair = betfair
        self.clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)  # the tests fix it

    # ---- ledger -------------------------------------------------------------

    def ledger(self, day: date) -> list[dict[str, Any]]:
        prefix = f"{ORDERS_PREFIX}{day.isoformat()}/"
        out = []
        for name in self.store.names(prefix):
            try:
                rec = self.store.get(name)
            except Exception as exc:  # noqa: BLE001
                log.error("order record unreadable: %s: %s", name, type(exc).__name__)
                continue
            rec["_name"] = name
            out.append(rec)
        return out

    @staticmethod
    def placed_keys(ledger: list[dict[str, Any]], mode: str) -> set[str]:
        return {r["order"]["key"] for r in ledger if r.get("event") == "placed" and r.get("mode") == mode and r.get("order", {}).get("key")}

    @staticmethod
    def day_at_risk(ledger: list[dict[str, Any]], mode: str) -> Decimal:
        total = Decimal("0")
        for r in ledger:
            if r.get("mode") != mode:
                continue
            if r.get("event") == "placed" or (r.get("event") == "test_order" and r.get("placed")):
                total += Decimal(str(r.get("at_risk") or "0"))
        return money(total)

    @staticmethod
    def open_paper(ledger: list[dict[str, Any]]) -> list[dict[str, Any]]:
        cancelled = {r["order_ref"] for r in ledger if r.get("event") == "cancelled" and r.get("mode") == "paper"}
        return [r for r in ledger if r.get("event") == "placed" and r.get("mode") == "paper" and r["order"]["customer_order_ref"] not in cancelled]

    def _record(self, event: str, by: str | None, **fields: Any) -> dict[str, Any]:
        rec = {"at": now_iso(), "event": event, "by": by, **fields}
        day = fields.get("date") or now_iso()[:10]
        try:
            rec["_name"] = self.store.put(f"{ORDERS_PREFIX}{day}/", {k: v for k, v in rec.items() if k != "_name"})
        except Exception as exc:  # noqa: BLE001
            log.error("order record not stored: %s", type(exc).__name__, extra={"event": "order_record_error"})
            rec["_name"] = None
        return rec

    # ---- build --------------------------------------------------------------

    def mode(self) -> str:
        return str(self.settings.values.get("mode") or "paper")

    def build(self, body: dict[str, Any], day: date, markets: list[dict[str, Any]], now: datetime | None = None) -> dict[str, Any]:
        """The order a Place would send, with every reason it would be refused. Nothing is sent, nothing is stored."""
        now = now or self.clock()
        values = self.settings.values
        mode = self.mode()
        slot = body["slot"]
        line, back = body["line"], body["back"]
        refusals: list[str] = []

        allowed, why = self.settings.placing_allowed(mode)
        if not allowed:
            refusals.append(why)

        resolution = resolve_line(day, line.get("race"), line.get("horse"), markets, line.get("id"))
        if resolution["status"] != "resolved":
            refusals.append(f"not resolved: {resolution['flag']}")
        elif parse_betfair_time(resolution["start_time"]) <= now:
            refusals.append(f"the race started at {resolution['start_london']} UK; nothing is laid in play")

        back_price, back_stake = first_number(back.get("price")), first_number(back.get("stake"))
        if back_price is None or back_price <= 1:
            refusals.append(f"back price not read as a price above 1: {back.get('price')!r}")
        if back_stake is None or back_stake <= 0:
            refusals.append(f"back stake not read as a positive amount: {back.get('stake')!r}")

        target = first_number(line.get("lay_target"))
        price = tick_down(target) if target is not None else None
        if target is None:
            refusals.append(f"lay target not read as a price: {line.get('lay_target')!r}")
        elif price is None:
            refusals.append(f"lay target {target} is outside Betfair's prices {MIN_PRICE} to {MAX_PRICE}")

        cap_text = line.get("betfair_cap")
        course_cap = first_number(cap_text) if cap_text not in (None, "") else None
        if cap_text not in (None, "") and course_cap is None:
            refusals.append(f"Betfair cap not read as an amount: {cap_text!r}")

        size = liability = None
        if price is not None and back_price is not None and back_stake is not None and back_price > 1 and back_stake > 0:
            size = money(back_stake * back_price / price, ROUND_DOWN)
            liability = money(size * (price - 1))
            ok, why = min_size_ok(size)
            if not ok:
                refusals.append(why)
            if course_cap is not None and size > course_cap:
                refusals.append(
                    f"size {size} is above the slip's Betfair cap of {course_cap} for the course, read as a cap on the lay's size; "
                    "that reading is an assumption until the handover with Mark (Claude Strategy reads the cap as the Betfair BACK stake at a course)"
                )
            per_order = Decimal(str(values["caps"]["per_order_at_risk_gbp"]))
            if liability > per_order:
                refusals.append(f"liability {liability} is above the per-order cap of {money(per_order)} at risk")

        ledger = self.ledger(day)
        key = order_key(day, slot, line.get("race"), line.get("horse"))
        if key in self.placed_keys(ledger, mode):
            refusals.append(f"this line already has a {mode} order today; a line is never placed twice")
        so_far = self.day_at_risk(ledger, mode)
        per_day = Decimal(str(values["caps"]["per_day_at_risk_gbp"]))
        if liability is not None and so_far + liability > per_day:
            refusals.append(f"the day's {mode} money at risk would be {money(so_far + liability)}, above the per-day cap of {money(per_day)}")

        order_ref = customer_order_ref(key, day, slot)
        strategy = strategy_ref(slot)
        resolved = resolution["status"] == "resolved"
        out: dict[str, Any] = {
            "status": "ok" if not refusals else "refused",
            "refusals": refusals,
            "mode": mode,
            "date": day.isoformat(),
            "slot": slot,
            "key": key,
            "customer_order_ref": order_ref,
            "customer_strategy_ref": strategy,
            "line": {"id": line.get("id"), "race": line.get("race"), "horse": line.get("horse"), "lay_target": line.get("lay_target"), "betfair_cap": cap_text},
            "back": {"price": back.get("price"), "stake": back.get("stake"), "where": back.get("where")},
            "resolution": resolution,
            "market_id": resolution.get("market_id"),
            "selection_id": resolution.get("selection_id"),
            "runner_name": resolution.get("runner_name"),
            "market_name": resolution.get("market_name"),
            "venue": resolution.get("venue"),
            "start_london": resolution.get("start_london"),
            "start_time": resolution.get("start_time"),
            "side": SIDE_LAY,
            "order_type": "LIMIT",
            "persistence": PERSISTENCE,
            "lay_target": str(target) if target is not None else None,
            "price": str(price) if price is not None else None,
            "size": str(size) if size is not None else None,
            "liability": str(liability) if liability is not None else None,
            "at_risk": str(liability) if liability is not None else None,
            "course_cap": str(course_cap) if course_cap is not None else None,
            "caps": {"per_order_at_risk_gbp": str(money(Decimal(str(values["caps"]["per_order_at_risk_gbp"])))), "per_day_at_risk_gbp": str(money(per_day)), "day_so_far": str(so_far)},
            "ticket": None,
            "request": None,
        }
        if resolved and price is not None and size is not None:
            out["ticket"] = ticket_for(resolution["market_id"], resolution["selection_id"], SIDE_LAY, price, size)
            out["request"] = place_request(resolution["market_id"], resolution["selection_id"], SIDE_LAY, price, size, order_ref, strategy)
        return out

    # ---- place and cancel ------------------------------------------------------

    def place(self, body: dict[str, Any], day: date, markets: list[dict[str, Any]], by: str, now: datetime | None = None) -> dict[str, Any]:
        order = self.build(body, day, markets, now)
        mode = order["mode"]
        if order["status"] != "ok":
            rec = self._record("refused", by, date=day.isoformat(), mode=mode, order=order, reason=body.get("reason"))
            self.activity.record("order_refused", by, mode=mode, line=order["line"]["race"] + " " + str(order["line"]["horse"]), refusals=order["refusals"])
            raise OrderRefused(409, "refused: " + "; ".join(order["refusals"]))
        if body.get("ticket") != order["ticket"]:
            raise OrderRefused(409, f"the order built now ({order['ticket']}) is not the one confirmed ({body.get('ticket')}): read it again before placing")
        started = time.monotonic()
        if mode == "paper":
            rec = self._record(
                "placed", by, date=day.isoformat(), mode=mode, order=order, sent=False, bet_id=None, betfair=None,
                at_risk=order["at_risk"], order_ref=order["customer_order_ref"], reason=body.get("reason"), ms=round((time.monotonic() - started) * 1000, 1),
            )
            self.activity.record("order_placed", by, mode=mode, order_ref=order["customer_order_ref"], race=order["line"]["race"], horse=order["line"]["horse"], price=order["price"], size=order["size"], liability=order["liability"], sent=False)
            return rec
        # real: one call, recorded whatever happens
        try:
            response = self.betfair.place_orders(order["request"], by)
        except BetfairRefused as exc:
            self._record("place_failed", by, date=day.isoformat(), mode=mode, order=order, sent=True, error=exc.detail, order_ref=order["customer_order_ref"], reason=body.get("reason"))
            self.activity.record("order_place_failed", by, mode=mode, order_ref=order["customer_order_ref"], error=exc.detail)
            raise OrderRefused(exc.status, f"placeOrders failed: {exc.detail}") from exc
        report = (response.get("instructionReports") or [{}])[0]
        ok = response.get("status") == "SUCCESS" and report.get("status") == "SUCCESS" and report.get("betId")
        if not ok:
            rec = self._record("place_failed", by, date=day.isoformat(), mode=mode, order=order, sent=True, betfair=response, order_ref=order["customer_order_ref"], reason=body.get("reason"))
            self.activity.record("order_place_failed", by, mode=mode, order_ref=order["customer_order_ref"], error=f"{response.get('errorCode')} / {report.get('errorCode')}")
            raise OrderRefused(424, f"Betfair did not place it: {response.get('status')} {response.get('errorCode') or ''} {report.get('status') or ''} {report.get('errorCode') or ''}".strip())
        rec = self._record(
            "placed", by, date=day.isoformat(), mode=mode, order=order, sent=True, bet_id=report["betId"], betfair=response,
            at_risk=order["at_risk"], order_ref=order["customer_order_ref"], reason=body.get("reason"), ms=round((time.monotonic() - started) * 1000, 1),
            size_matched=report.get("sizeMatched"), order_status=report.get("orderStatus"),
        )
        self.activity.record("order_placed", by, mode=mode, order_ref=order["customer_order_ref"], bet_id=report["betId"], race=order["line"]["race"], horse=order["line"]["horse"], price=order["price"], size=order["size"], liability=order["liability"], sent=True)
        return rec

    def cancel(self, order_ref: str, reason: str | None, by: str, day: date | None = None) -> dict[str, Any]:
        """A separate, deliberate call: cancels one order of today's ledger by its reference."""
        day = day or date.fromisoformat(now_iso()[:10])
        ledger = self.ledger(day)
        placed = [r for r in ledger if r.get("event") == "placed" and r.get("order_ref") == order_ref]
        if not placed:
            raise OrderRefused(404, f"no placed order {order_ref} in the ledger for {day.isoformat()}")
        rec = placed[-1]
        if any(r.get("event") == "cancelled" and r.get("order_ref") == order_ref for r in ledger):
            raise OrderRefused(409, f"{order_ref} is already cancelled")
        mode = rec["mode"]
        if mode == "paper":
            out = self._record("cancelled", by, date=day.isoformat(), mode=mode, order_ref=order_ref, order=rec["order"], sent=False, reason=reason, betfair=None)
            self.activity.record("order_cancelled", by, mode=mode, order_ref=order_ref, sent=False)
            return out
        market_id, bet_id = rec["order"]["market_id"], rec.get("bet_id")
        try:
            response = self.betfair.cancel_orders(market_id, [{"betId": bet_id}], order_ref, by)
        except BetfairRefused as exc:
            self._record("cancel_failed", by, date=day.isoformat(), mode=mode, order_ref=order_ref, order=rec["order"], sent=True, error=exc.detail, reason=reason)
            raise OrderRefused(exc.status, f"cancelOrders failed: {exc.detail}") from exc
        report = (response.get("instructionReports") or [{}])[0]
        if response.get("status") != "SUCCESS" or report.get("status") != "SUCCESS":
            self._record("cancel_failed", by, date=day.isoformat(), mode=mode, order_ref=order_ref, order=rec["order"], sent=True, betfair=response, reason=reason)
            raise OrderRefused(424, f"Betfair did not cancel it: {response.get('status')} {response.get('errorCode') or ''} {report.get('errorCode') or ''}".strip())
        out = self._record("cancelled", by, date=day.isoformat(), mode=mode, order_ref=order_ref, order=rec["order"], sent=True, bet_id=bet_id, betfair=response, size_cancelled=report.get("sizeCancelled"), reason=reason)
        self.activity.record("order_cancelled", by, mode=mode, order_ref=order_ref, bet_id=bet_id, size_cancelled=report.get("sizeCancelled"), sent=True)
        return out

    # ---- read -----------------------------------------------------------------

    def view(self, day: date) -> dict[str, Any]:
        ledger = self.ledger(day)
        values = self.settings.values
        return {
            "date": day.isoformat(),
            "mode": self.mode(),
            "caps": values["caps"],
            "at_risk": {"paper": str(self.day_at_risk(ledger, "paper")), "real": str(self.day_at_risk(ledger, "real"))},
            "records": [{k: v for k, v in r.items() if k != "_name"} for r in ledger],
        }

    def current(self, day: date, by: str) -> dict[str, Any]:
        """Open orders: the paper ledger's in paper mode; Betfair's listCurrentOrders for FB13's references in real mode."""
        mode = self.mode()
        if mode == "paper":
            open_ = self.open_paper(self.ledger(day))
            return {"date": day.isoformat(), "mode": mode, "sent": False, "orders": [{"customerOrderRef": r["order_ref"], "marketId": r["order"]["market_id"], "selectionId": r["order"]["selection_id"], "side": r["order"]["side"], "priceSize": {"price": r["order"]["price"], "size": r["order"]["size"]}, "status": "PAPER", "placedDate": r["at"]} for r in open_]}
        refs = sorted({strategy_ref(s) for s in SLOTS} | {TEST_STRATEGY_REF})
        response = self.betfair.current_orders(by, customer_strategy_refs=refs)
        return {"date": day.isoformat(), "mode": mode, "sent": True, "orders": response.get("currentOrders") or [], "more_available": response.get("moreAvailable")}

    # ---- the test order ------------------------------------------------------------

    def test_order(self, market_id: str, selection_id: int, confirmation: str, by: str, day: date, markets: list[dict[str, Any]], now: datetime | None = None) -> dict[str, Any]:
        now = now or self.clock()
        values = self.settings.values
        if values.get("mode") != "real":
            raise OrderRefused(409, "the stored settings say paper: the test order is real money and runs only when the stored mode is real")
        allowed, why = self.settings.placing_allowed("real")
        if not allowed:
            raise OrderRefused(409, f"refused: {why}")
        if (confirmation or "").strip() != TEST_CONFIRMATION:
            raise OrderRefused(409, f"the confirmation was not typed in these exact words: {TEST_CONFIRMATION}")
        if not self.betfair.logged_in:
            raise OrderRefused(409, f"not logged in to Betfair (session: {self.betfair.state})")
        market = next((m for m in markets if m.get("market_id") == market_id), None)
        if market is None:
            raise OrderRefused(409, f"market {market_id} is not in today's GB and IE win catalogue")
        if parse_betfair_time(market["start_time"]) <= now:
            raise OrderRefused(409, f"market {market_id} started at {market.get('start_london')} UK; the test order goes on a race not yet run")
        runner = next((r for r in market.get("runners", []) if int(r.get("selection_id") or 0) == int(selection_id)), None)
        if runner is None:
            raise OrderRefused(409, f"selection {selection_id} is not a runner in market {market_id}")
        ledger = self.ledger(day)
        per_order = Decimal(str(values["caps"]["per_order_at_risk_gbp"]))
        per_day = Decimal(str(values["caps"]["per_day_at_risk_gbp"]))
        so_far = self.day_at_risk(ledger, "real")
        if TEST_SIZE > per_order:
            raise OrderRefused(409, f"the test order's {TEST_SIZE} at risk is above the per-order cap of {money(per_order)}")
        if so_far + TEST_SIZE > per_day:
            raise OrderRefused(409, f"the day's real money at risk would be {money(so_far + TEST_SIZE)}, above the per-day cap of {money(per_day)}")

        order_ref = f"FB13-TEST-{now.strftime('%H%M%S')}"
        request = place_request(market_id, selection_id, SIDE_BACK, TEST_PRICE, TEST_SIZE, order_ref, TEST_STRATEGY_REF)
        steps: list[dict[str, Any]] = []
        verdict: list[str] = []
        placed = False
        bet_id = None
        started = time.monotonic()

        def record(final: str) -> dict[str, Any]:
            rec = self._record(
                "test_order", by, date=day.isoformat(), mode="real", placed=placed, at_risk=str(TEST_SIZE) if placed else "0.00",
                order_ref=order_ref, bet_id=bet_id, market_id=market_id, selection_id=int(selection_id), runner_name=runner.get("name"),
                market_name=market.get("market_name"), venue=market.get("venue"), start_london=market.get("start_london"),
                side=SIDE_BACK, price=str(TEST_PRICE), size=str(TEST_SIZE), request=request, steps=steps, verdict=final, notes=verdict,
                ms=round((time.monotonic() - started) * 1000, 1),
            )
            self.activity.record("test_order", by, verdict=final, order_ref=order_ref, bet_id=bet_id, market_id=market_id)
            return rec

        # 1. place
        try:
            response = self.betfair.place_orders(request, by)
        except BetfairRefused as exc:
            steps.append({"step": "placeOrders", "ok": False, "error": exc.detail})
            raise OrderRefused(exc.status, f"test order: placeOrders failed: {exc.detail}; record {record('failed: placeOrders ' + exc.detail)['_name']}") from exc
        report = (response.get("instructionReports") or [{}])[0]
        if response.get("status") != "SUCCESS" or report.get("status") != "SUCCESS" or not report.get("betId"):
            steps.append({"step": "placeOrders", "ok": False, "response": response})
            rec = record(f"failed: Betfair did not place it ({response.get('status')} {response.get('errorCode') or ''} {report.get('errorCode') or ''})".strip())
            raise OrderRefused(424, rec["verdict"])
        bet_id, placed = report["betId"], True
        steps.append({"step": "placeOrders", "ok": True, "bet_id": bet_id, "order_status": report.get("orderStatus"), "size_matched": report.get("sizeMatched"), "response": response})
        if Decimal(str(report.get("sizeMatched") or 0)) > 0:
            verdict.append(f"MATCHED on placing: {report.get('sizeMatched')} at {report.get('averagePriceMatched')}; the matched part stands and cannot be cancelled")

        # 2. it is there
        current = self._current_by_bet(bet_id, by)
        mine = [o for o in current.get("currentOrders") or [] if str(o.get("betId")) == str(bet_id)]
        if not mine:
            steps.append({"step": "listCurrentOrders", "ok": False, "found": 0, "response": current})
            verdict.append("placed but not seen in listCurrentOrders")
        else:
            o = mine[0]
            steps.append({"step": "listCurrentOrders", "ok": True, "found": len(mine), "status": o.get("status"), "size_matched": o.get("sizeMatched"), "size_remaining": o.get("sizeRemaining"), "price_size": o.get("priceSize"), "customer_order_ref": o.get("customerOrderRef"), "customer_strategy_ref": o.get("customerStrategyRef")})
            if o.get("status") != "EXECUTABLE":
                verdict.append(f"after placing, status {o.get('status')} not EXECUTABLE")
            if Decimal(str(o.get("sizeMatched") or 0)) > 0:
                verdict.append(f"MATCHED: sizeMatched {o.get('sizeMatched')}")

        # 3. cancel
        try:
            cancel = self.betfair.cancel_orders(market_id, [{"betId": bet_id}], order_ref, by)
        except BetfairRefused as exc:
            steps.append({"step": "cancelOrders", "ok": False, "error": exc.detail})
            rec = record("failed: cancelOrders " + exc.detail + "; THE ORDER MAY STILL BE OPEN")
            raise OrderRefused(exc.status, rec["verdict"]) from exc
        creport = (cancel.get("instructionReports") or [{}])[0]
        cancel_ok = cancel.get("status") == "SUCCESS" and creport.get("status") == "SUCCESS"
        steps.append({"step": "cancelOrders", "ok": cancel_ok, "size_cancelled": creport.get("sizeCancelled"), "response": cancel})
        if not cancel_ok:
            verdict.append(f"cancelOrders not SUCCESS: {cancel.get('status')} {cancel.get('errorCode') or ''} {creport.get('errorCode') or ''}; THE ORDER MAY STILL BE OPEN".strip())

        # 4. it is gone
        after = self._current_by_bet(bet_id, by)
        still = [o for o in after.get("currentOrders") or [] if str(o.get("betId")) == str(bet_id) and o.get("status") == "EXECUTABLE"]
        steps.append({"step": "listCurrentOrders", "ok": not still, "still_executable": len(still), "response": after})
        if still:
            verdict.append("STILL EXECUTABLE after cancelOrders")

        final = "passed: placed, seen, cancelled, gone" if not verdict else "failed: " + "; ".join(verdict)
        rec = record(final)
        if verdict:
            raise OrderRefused(424, rec["verdict"])
        return rec

    def _current_by_bet(self, bet_id: str, by: str) -> dict[str, Any]:
        try:
            return self.betfair.current_orders(by, bet_ids=[bet_id])
        except BetfairRefused as exc:
            return {"currentOrders": None, "error": exc.detail}

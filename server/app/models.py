"""Request bodies. Pydantic v2, extra="forbid" everywhere (CHI-POL-008 §3.4).

`mode` and `page_access_confirmed` are absent from ConfigUpdate on purpose:
a body naming them is rejected before any code of ours runs.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CapsUpdate(Strict):
    per_order_at_risk_gbp: float | None = None
    per_day_at_risk_gbp: float | None = None


class ConfigUpdate(Strict):
    caps: CapsUpdate | None = None
    operators: list[str] | None = None
    reason: str | None = Field(default=None, max_length=300)


class ControlBody(Strict):
    reason: str | None = Field(default=None, max_length=300)


class ResolveLine(Strict):
    id: str | None = Field(default=None, max_length=80)
    race: str = Field(max_length=120)
    horse: str = Field(max_length=120)


class ResolveRequest(Strict):
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    lines: list[ResolveLine] = Field(max_length=200)


# ---- step 3: orders. Cell text travels as text; the server reads the numbers and refuses what it cannot read. ----


class BackLeg(Strict):
    price: str = Field(max_length=20)
    stake: str = Field(max_length=20)
    where: str | None = Field(default=None, max_length=80)


class OrderLine(Strict):
    id: str | None = Field(default=None, max_length=80)
    race: str = Field(max_length=120)
    horse: str = Field(max_length=120)
    lay_target: str = Field(max_length=40)
    betfair_cap: str | None = Field(default=None, max_length=40)


class OrderRequest(Strict):
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    slot: str = Field(pattern=r"^\d{2}:\d{2}$")
    line: OrderLine
    back: BackLeg


class PlaceRequest(OrderRequest):
    ticket: str = Field(min_length=16, max_length=16, pattern=r"^[0-9a-f]{16}$")
    reason: str | None = Field(default=None, max_length=300)


class CancelRequest(Strict):
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    order_ref: str = Field(min_length=1, max_length=40)
    reason: str | None = Field(default=None, max_length=300)


class TestOrderRequest(Strict):
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    market_id: str = Field(pattern=r"^1\.\d{1,12}$")
    selection_id: int = Field(ge=1)
    confirmation: str = Field(max_length=120)

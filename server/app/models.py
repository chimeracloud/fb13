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

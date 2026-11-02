"""Structured JSON logs for Cloud Logging (CHI-POL-008 §3.3).

Every entry carries severity, message, timestamp, service_name and trace_id.
The trace id is set per request by the middleware in main.py and read here
through a context variable, so a log line written anywhere during a request
carries that request's trace. No print statements anywhere in this package.

Nothing here, or anywhere else in this unit, logs a credential or a token.
"""

from __future__ import annotations

import contextvars
import json
import logging
import os
import sys
from datetime import datetime, timezone

from app.version import SERVICE_NAME

PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "chiops")

trace_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("fb13_trace_id", default="")

# Extra fields a log call may attach with logging's `extra=` and have carried through.
CARRIED = ("event", "method", "path", "status", "ms", "by")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        trace = trace_id_var.get("")
        entry: dict[str, object] = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "service_name": SERVICE_NAME,
            "trace_id": trace,
        }
        if trace:
            entry["logging.googleapis.com/trace"] = f"projects/{PROJECT}/traces/{trace}"
        for key in CARRIED:
            if hasattr(record, key):
                entry[key] = getattr(record, key)
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str, ensure_ascii=False)


def configure(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    # uvicorn's own loggers go through the root handler too, as JSON.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers[:] = []
        lg.propagate = True

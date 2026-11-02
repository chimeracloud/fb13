"""Counters for GET /metrics (Prometheus text) and GET /admin/stats. In memory, per instance."""

from __future__ import annotations

import resource
import sys
import threading
import time
from collections import Counter
from typing import Any


class Metrics:
    def __init__(self) -> None:
        self.started = time.time()
        self.requests: Counter[tuple[str, str, int]] = Counter()
        self.latency_ms_sum: Counter[str] = Counter()
        self.refusals = 0
        self.errors = 0
        self._lock = threading.Lock()

    def observe(self, method: str, route: str, status: int, ms: float) -> None:
        with self._lock:
            self.requests[(method, route, int(status))] += 1
            self.latency_ms_sum[route] += ms
            if status >= 500:
                self.errors += 1

    def refused(self) -> None:
        with self._lock:
            self.refusals += 1

    @property
    def uptime_s(self) -> float:
        return time.time() - self.started

    def totals(self) -> dict[str, Any]:
        with self._lock:
            by_status: Counter[str] = Counter()
            for (_, _, status), n in self.requests.items():
                by_status[f"{status // 100}xx"] += n
            return {
                "requests": sum(self.requests.values()),
                "by_status": dict(sorted(by_status.items())),
                "auth_refusals": self.refusals,
                "server_errors": self.errors,
                "uptime_s": round(self.uptime_s, 1),
            }

    def render(self, gauges: dict[str, float], labels: dict[str, str]) -> str:
        """Prometheus exposition text. `labels` are added to every series."""
        label_text = ",".join(f'{k}="{v}"' for k, v in labels.items())
        base = f"{{{label_text}}}" if label_text else ""

        def series(name: str, extra: dict[str, Any], value: Any) -> str:
            parts = [label_text] if label_text else []
            parts += [f'{k}="{v}"' for k, v in extra.items()]
            return f"{name}{{{','.join(parts)}}} {value}" if parts else f"{name} {value}"

        lines = [
            "# HELP fb13_uptime_seconds Seconds since this instance started.",
            "# TYPE fb13_uptime_seconds gauge",
            f"fb13_uptime_seconds{base} {self.uptime_s:.1f}",
            "# HELP fb13_requests_total Requests answered, by method, route and status.",
            "# TYPE fb13_requests_total counter",
        ]
        with self._lock:
            for (method, route, status), n in sorted(self.requests.items()):
                lines.append(series("fb13_requests_total", {"method": method, "route": route, "status": status}, n))
            lines += [
                "# HELP fb13_request_latency_ms_sum Total request time, by route.",
                "# TYPE fb13_request_latency_ms_sum counter",
            ]
            for route, ms in sorted(self.latency_ms_sum.items()):
                lines.append(series("fb13_request_latency_ms_sum", {"route": route}, f"{ms:.1f}"))
            lines += [
                "# HELP fb13_auth_refusals_total Requests refused at the Access gate.",
                "# TYPE fb13_auth_refusals_total counter",
                f"fb13_auth_refusals_total{base} {self.refusals}",
                "# HELP fb13_server_errors_total Responses with a 5xx status.",
                "# TYPE fb13_server_errors_total counter",
                f"fb13_server_errors_total{base} {self.errors}",
            ]
        for name, value in gauges.items():
            lines += [f"# TYPE {name} gauge", f"{name}{base} {value}"]
        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        rss_bytes = rss if sys.platform == "darwin" else rss * 1024  # Linux reports KiB
        lines += [
            "# TYPE process_resident_memory_bytes gauge",
            f"process_resident_memory_bytes{base} {int(rss_bytes)}",
            "# TYPE process_cpu_seconds_total counter",
            f"process_cpu_seconds_total{base} {time.process_time():.2f}",
        ]
        return "\n".join(lines) + "\n"

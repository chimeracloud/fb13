"""Append-only JSON objects: the unit's memory between requests and across restarts.

fb13-sa holds roles/storage.objectCreator and roles/storage.objectViewer on
chiops-fb13-config and chiops-fb13-orders, and nothing else. It can create an
object and read one. It cannot overwrite or delete, so nothing here ever
tries: every write is a new object named by its time, and a read takes the
newest.

    {prefix}{ms:013d}-{8 hex}.json      13-digit milliseconds, so name order is time order

Within one millisecond the hex would decide the order, which is no order at
all: the 0.6.3 build of 2 November 2026 failed on two tests whose records
fell in the same millisecond and came back reversed. So a clock-named object
from this process always takes a later millisecond than the one before it;
the service runs one instance, so the order of names is the order of writes.
A caller's explicit t_ms is used as given (the tests).

FB11 learned this on 21 September 2026, when settings written in place were
refused with 403 for a whole racing day and nobody noticed. Create-only from
the first commit, here, and enforced by IAM rather than by this code.

Two implementations of one interface: GcsStore for the service, MemoryStore
for the tests and for a process started with no bucket named. The Google
client is imported only when first used, so `import app.main` opens nothing.
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from typing import Any

JSON = dict[str, Any]


_name_lock = threading.Lock()
_last_ms = 0


def name_for(prefix: str, t_ms: int | None = None) -> str:
    global _last_ms
    if t_ms is None:
        with _name_lock:
            t_ms = max(int(time.time() * 1000), _last_ms + 1)
            _last_ms = t_ms
    return f"{prefix}{int(t_ms):013d}-{uuid.uuid4().hex[:8]}.json"


def dumps(data: JSON) -> bytes:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


class Store:
    """The interface. Every method may raise; the caller decides how loud to be."""

    kind = "none"
    location = ""

    def put(self, prefix: str, data: JSON, t_ms: int | None = None) -> str:
        """Create a new object under the prefix. Returns its name. Never overwrites."""
        raise NotImplementedError

    def names(self, prefix: str) -> list[str]:
        """Every .json object name under the prefix, oldest first."""
        raise NotImplementedError

    def get(self, name: str) -> JSON:
        raise NotImplementedError

    def reachable(self) -> bool:
        """One cheap call that proves the store answers. Raises if it does not."""
        raise NotImplementedError

    def latest(self, prefix: str) -> tuple[JSON | None, str | None]:
        names = self.names(prefix)
        if not names:
            return None, None
        return self.get(names[-1]), names[-1]

    def newest(self, prefix: str, n: int) -> list[tuple[str, JSON]]:
        """The newest n under a prefix, newest first."""
        return [(name, self.get(name)) for name in reversed(self.names(prefix)[-n:])]


class MemoryStore(Store):
    kind = "memory"
    location = "memory"

    def __init__(self) -> None:
        self._objects: dict[str, bytes] = {}
        self._lock = threading.Lock()

    def put(self, prefix: str, data: JSON, t_ms: int | None = None) -> str:
        name = name_for(prefix, t_ms)
        with self._lock:
            if name in self._objects:
                raise FileExistsError(name)
            self._objects[name] = dumps(data)
        return name

    def names(self, prefix: str) -> list[str]:
        with self._lock:
            return sorted(n for n in self._objects if n.startswith(prefix) and n.endswith(".json"))

    def get(self, name: str) -> JSON:
        with self._lock:
            raw = self._objects[name]
        return json.loads(raw.decode("utf-8"))

    def reachable(self) -> bool:
        return True


class GcsStore(Store):
    kind = "gcs"

    def __init__(self, bucket_name: str) -> None:
        self.bucket_name = bucket_name
        self.location = f"gs://{bucket_name}"
        self._bucket = None
        self._lock = threading.Lock()

    def _b(self):
        with self._lock:
            if self._bucket is None:
                from google.cloud import storage  # here, so that importing the app opens nothing

                self._bucket = storage.Client().bucket(self.bucket_name)
            return self._bucket

    def put(self, prefix: str, data: JSON, t_ms: int | None = None) -> str:
        name = name_for(prefix, t_ms)
        # if_generation_match=0: create only. An object already there makes this fail, never overwrite.
        self._b().blob(name).upload_from_string(dumps(data), content_type="application/json", if_generation_match=0)
        return name

    def names(self, prefix: str) -> list[str]:
        bucket = self._b()
        return sorted(b.name for b in bucket.client.list_blobs(bucket.name, prefix=prefix) if b.name.endswith(".json"))

    def get(self, name: str) -> JSON:
        return json.loads(self._b().blob(name).download_as_bytes().decode("utf-8"))

    def reachable(self) -> bool:
        bucket = self._b()
        list(bucket.client.list_blobs(bucket.name, max_results=1))
        return True


def open_store(bucket_name: str | None) -> Store:
    return GcsStore(bucket_name) if bucket_name else MemoryStore()

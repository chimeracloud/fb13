"""get_credential(name): the one way a credential reaches this unit (CHI-POL-040).

One interface, one module, one implementation behind it. Today the
implementation reads Google Secret Manager in chiops; when a credential
manager unit exists this file is replaced and nothing else changes. Recorded
as interim in the README and the CHANGELOG, as the policy asks.

Nothing outside this module names a secret. The logical names below are the
unit's configuration; the Secret Manager ids they resolve to are Charles's,
created long before FB13 and shared with other units. fb13-sa may read these
five and no other (bindings made 2 November 2026).

Charles, 2 November 2026: the DELAYED application key for all of FB13's REST
work (resolve, place, cancel, list). Betfair's own documentation says the
Delayed key places bets on the live exchange. The Live key is not named here
and is never used without his word.

Values are held in memory for the life of the process, never written, never
logged. Version 1 step 1 calls none of this; step 2 makes the first call, and
only after Charles gives the word for the first login (CHI-BRF-002).
"""

from __future__ import annotations

import os
import threading

PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "chiops")

# logical name -> Secret Manager secret id in chiops
NAMES: dict[str, str] = {
    "betfair_app_key": "betfair-app-key-delayed",
    "betfair_cert_pem": "betfair-cert-pem",
    "betfair_key_pem": "betfair-key-pem",
    "betfair_username": "betfair-username",
    "betfair_password": "betfair-password",
}

_values: dict[str, str] = {}
_reads: dict[str, int] = {name: 0 for name in NAMES}
_lock = threading.Lock()


class UnknownCredential(KeyError):
    pass


def get_credential(name: str) -> str:
    """The secret's current value. Raises UnknownCredential for a name not configured here."""
    if name not in NAMES:
        raise UnknownCredential(name)
    with _lock:
        if name in _values:
            return _values[name]
    from google.cloud import secretmanager  # here, so that importing the app opens nothing

    client = secretmanager.SecretManagerServiceClient()
    path = f"projects/{PROJECT}/secrets/{NAMES[name]}/versions/latest"
    value = client.access_secret_version(request={"name": path}).payload.data.decode("utf-8")
    with _lock:
        _values[name] = value
        _reads[name] += 1
    return value


def credential_names() -> dict[str, str]:
    """Logical names and the secret ids they resolve to. Names only, never a value."""
    return dict(NAMES)


def reads_so_far() -> dict[str, int]:
    """How many times each credential has been fetched from Secret Manager this process."""
    with _lock:
        return dict(_reads)

"""Who may call this API: a person who came through Cloudflare Access and is an operator.

The page at fb13.chimerasportstrading.com sits behind Cloudflare Access. Its
Pages Function (functions/api/[[path]].js) forwards /api/* here with the
Cf-Access-Jwt-Assertion header Access adds to every request it lets through.
This module verifies that token on every call: signature against the team's
published keys, issuer, audience, expiry; then the email it carries must be
on the stored operator list. Nothing else gets in. No token, no answer.

Unconfigured (no team domain or audience set), it refuses everything rather
than opening up. Cloud Run's own invoker check is off for this service
(Charles, 2 November 2026), so this is the gate.

Reference: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
"""

from __future__ import annotations

import hashlib
import logging
import threading
import time
from typing import Any

import jwt

log = logging.getLogger(__name__)

HEADER = "Cf-Access-Jwt-Assertion"
MAX_TOKEN_CHARS = 8192


class Refused(Exception):
    def __init__(self, status: int, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


def team_url(team: str | None) -> str:
    """'chimera', 'chimera.cloudflareaccess.com' or 'https://chimera.cloudflareaccess.com' -> the issuer URL."""
    t = (team or "").strip().rstrip("/")
    if not t:
        return ""
    for scheme in ("https://", "http://"):
        if t.startswith(scheme):
            t = t[len(scheme):]
    if "." not in t:
        t = f"{t}.cloudflareaccess.com"
    return f"https://{t}"


class AccessVerifier:
    def __init__(self, team: str | None = "", aud: str | None = "", jwk_client: Any = None) -> None:
        self.issuer = team_url(team)
        self.aud = (aud or "").strip()
        self._jwk_client = jwk_client
        self._cache: dict[str, tuple[dict[str, Any], float]] = {}
        self._lock = threading.Lock()

    @property
    def configured(self) -> bool:
        return bool(self.issuer and self.aud)

    @property
    def certs_url(self) -> str:
        return f"{self.issuer}/cdn-cgi/access/certs" if self.issuer else ""

    def _client(self):
        if self._jwk_client is None:
            self._jwk_client = jwt.PyJWKClient(self.certs_url, cache_keys=True, lifespan=3600)
        return self._jwk_client

    def verify(self, token: str | None) -> dict[str, Any]:
        """The token's claims with 'email' normalised. Raises Refused with the HTTP status to answer."""
        if not self.configured:
            raise Refused(503, "sign-in is not configured: the Access team domain and audience are not set")
        if not token or len(token) > MAX_TOKEN_CHARS:
            raise Refused(401, "no Access token")
        key = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with self._lock:
            hit = self._cache.get(key)
        if hit and hit[1] > time.time():
            return dict(hit[0])
        try:
            signing_key = self._client().get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self.aud,
                issuer=self.issuer,
                options={"require": ["exp", "iat", "aud", "iss"]},
                leeway=30,
            )
        except jwt.exceptions.PyJWKClientConnectionError as exc:
            raise Refused(503, f"the Access keys could not be fetched: {type(exc).__name__}") from exc
        except jwt.PyJWTError as exc:
            raise Refused(401, f"Access token refused: {type(exc).__name__}") from exc
        except Exception as exc:  # noqa: BLE001 - anything else is a refusal too, never an open door
            raise Refused(401, f"Access token refused: {type(exc).__name__}") from exc
        email = str(claims.get("email") or "").strip().lower()
        if not email:
            raise Refused(401, "Access token carries no email")
        claims["email"] = email
        with self._lock:
            if len(self._cache) > 512:
                self._cache.clear()
            self._cache[key] = (dict(claims), float(claims["exp"]))
        return dict(claims)


def operator_email(claims: dict[str, Any], operators: list[str]) -> str:
    """The verified email, if it is on the operator list. Raises Refused(403) if not."""
    email = str(claims.get("email") or "").strip().lower()
    if not email or email not in operators:
        raise Refused(403, f"{email or 'this account'} is not an operator of FB13")
    return email

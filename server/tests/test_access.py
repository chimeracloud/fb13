import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.access import AccessVerifier, Refused, operator_email, team_url

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ISSUER = "https://chimera.cloudflareaccess.com"
AUD = "aud0123456789abcdef"


class FakeJwkClient:
    def __init__(self):
        self.calls = 0

    def get_signing_key_from_jwt(self, token):
        self.calls += 1
        return SimpleNamespace(key=KEY.public_key())


def token(**over):
    now = int(time.time())
    claims = {"aud": [AUD], "iss": ISSUER, "email": "Cloud@ascotwm.com", "iat": now, "exp": now + 600, "sub": "abc"}
    claims.update(over)
    for k in [k for k, v in claims.items() if v is None]:
        del claims[k]
    return jwt.encode(claims, KEY, algorithm="RS256", headers={"kid": "k1"})


def verifier():
    client = FakeJwkClient()
    return AccessVerifier("chimera", AUD, jwk_client=client), client


def test_team_url_forms():
    assert team_url("chimera") == ISSUER
    assert team_url("chimera.cloudflareaccess.com") == ISSUER
    assert team_url("https://chimera.cloudflareaccess.com/") == ISSUER
    assert team_url("") == "" and team_url(None) == ""


def test_unconfigured_refuses_everything_with_503():
    v = AccessVerifier("", "")
    assert v.configured is False
    with pytest.raises(Refused) as exc:
        v.verify(token())
    assert exc.value.status == 503


def test_valid_token_gives_the_email_lower_cased_and_is_cached():
    v, client = verifier()
    assert v.configured and v.certs_url == f"{ISSUER}/cdn-cgi/access/certs"
    t = token()
    assert v.verify(t)["email"] == "cloud@ascotwm.com"
    assert v.verify(t)["email"] == "cloud@ascotwm.com"
    assert client.calls == 1


@pytest.mark.parametrize("bad", [
    {"aud": ["someone-else"]},
    {"iss": "https://other.cloudflareaccess.com"},
    {"exp": int(time.time()) - 120},
    {"email": None},
    {"email": "   "},
])
def test_refused_tokens_are_401(bad):
    v, _ = verifier()
    with pytest.raises(Refused) as exc:
        v.verify(token(**bad))
    assert exc.value.status == 401


def test_rubbish_and_nothing_are_401():
    v, _ = verifier()
    for t in (None, "", "not.a.token", "x" * 9000):
        with pytest.raises(Refused) as exc:
            v.verify(t)
        assert exc.value.status == 401


def test_wrong_key_is_401():
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = int(time.time())
    forged = jwt.encode({"aud": [AUD], "iss": ISSUER, "email": "x@y.z", "iat": now, "exp": now + 60}, other, algorithm="RS256", headers={"kid": "k1"})
    v, _ = verifier()
    with pytest.raises(Refused) as exc:
        v.verify(forged)
    assert exc.value.status == 401


def test_operator_list_is_the_second_gate():
    assert operator_email({"email": "cloud@ascotwm.com"}, ["cloud@ascotwm.com"]) == "cloud@ascotwm.com"
    with pytest.raises(Refused) as exc:
        operator_email({"email": "cloud@ascotwm.com"}, [])
    assert exc.value.status == 403
    with pytest.raises(Refused):
        operator_email({}, ["cloud@ascotwm.com"])

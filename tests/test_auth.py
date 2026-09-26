"""Supabase auth wiring: route registration, token guards, and key handling."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from webcrawler import supabase as sb
from webcrawler.api import create_app
from webcrawler.auth import authenticate
from webcrawler.jobs import CrawlJobStore
from webcrawler.supabase import (
    SupabaseAuthError,
    SupabaseError,
    SupabaseSettings,
    SupabaseStore,
    generate_api_key,
    hash_api_key,
    verify_token,
)

PROJECT_URL = "https://project.supabase.co"
USER_ID = "11111111-2222-3333-4444-555555555555"

@pytest.fixture
def client():
    with TemporaryDirectory() as tmp:
        app = create_app(Path(tmp))
        with TestClient(app) as c:
            yield c

# A throwaway RSA keypair stands in for Supabase's signing keys, so the tests
# exercise real signature, expiry, audience and issuer checks.
@pytest.fixture(scope="module")
def signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def jwks(monkeypatch, signing_key):
    """Point the verifier at our throwaway public key.

    The real code fetches Supabase's JWKS document; stubbing the client keeps
    the test offline while still exercising real signature verification.
    """

    class StubJWKClient:
        def get_signing_key_from_jwt(self, token):
            class Key:
                key = signing_key.public_key()

            return Key()

    monkeypatch.setattr(sb, "PyJWKClient", lambda *a, **k: StubJWKClient())
    monkeypatch.setattr(sb, "_jwks", sb._JWKSCache())
    monkeypatch.setattr(
        sb, "SETTINGS", _settings(url=PROJECT_URL, anon_key="sb_publishable_test")
    )
    return signing_key.public_key()

def _settings(**overrides: str) -> SupabaseSettings:
    base = {
        "url": PROJECT_URL,
        "anon_key": "sb_publishable_test",
        "service_role_key": "",
        "credential_key": "",
    }
    base.update(overrides)
    return SupabaseSettings(**base)  # type: ignore[arg-type]

def make_token(
    signing_key,
    *,
    subject: str = USER_ID,
    email: str = "user@example.com",
    expires_in: int = 3600,
    audience: str = "authenticated",
    issuer: str | None = None,
    role: str = "authenticated",
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "email": email,
        "role": role,
        "aud": audience,
        "iss": issuer or f"{PROJECT_URL}/auth/v1",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
        "email_confirmed_at": now.isoformat(),
        "user_metadata": {"full_name": "Test User"},
        "app_metadata": {"provider": "google"},
    }
    return jwt.encode(payload, signing_key, algorithm="RS256", headers={"kid": "test-key"})

def test_auth_config_is_reachable(client):
    r = client.get("/api/auth/config")
    assert r.status_code == 200
    body = r.json()
    assert "providers" in body
    assert set(body["providers"]) == {"email", "google", "github"}

def test_auth_callback_serves_the_spa(client):
    """Google, GitHub and password-reset links all land here, so it must
    serve index.html. A regression breaks every OAuth sign-in silently."""
    r = client.get("/auth/callback")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")

def test_auth_routes_are_not_swallowed_by_spa(client):
    config = client.get("/api/auth/config")
    assert config.status_code == 200
    assert "providers" in config.json()

    # Everything else must answer 401, not 200 with the SPA shell.
    for path in ("/api/me", "/api/me/history", "/api/me/api-keys", "/api/me/credentials"):
        r = client.get(path)
        assert r.status_code == 401, path
        assert "detail" in r.json()

def test_health_reports_auth_configuration(client):
    body = client.get("/health").json()
    assert "auth" in body
    assert isinstance(body["auth"]["configured"], bool)

def test_valid_token_yields_the_user(jwks, signing_key):
    user = verify_token(make_token(signing_key))
    assert user.id == "11111111-2222-3333-4444-555555555555"
    assert user.email == "user@example.com"
    assert user.provider == "google"
    assert user.full_name == "Test User"
    assert user.email_confirmed is True
    assert not user.is_anonymous

def test_expired_token_is_rejected(jwks, signing_key):
    token = make_token(signing_key, expires_in=-10)
    with pytest.raises(SupabaseAuthError, match="expired"):
        verify_token(token)

def test_wrong_audience_is_rejected(jwks, signing_key):
    token = make_token(signing_key, audience="something-else")
    with pytest.raises(SupabaseAuthError, match="Invalid access token"):
        verify_token(token)

def test_wrong_issuer_is_rejected(jwks, signing_key):
    token = make_token(signing_key, issuer="https://evil.example.com/auth/v1")
    with pytest.raises(SupabaseAuthError, match="Invalid access token"):
        verify_token(token)

def test_token_signed_by_another_key_is_rejected(jwks, signing_key):
    """A forged token must not pass just because the claims look right."""
    impostor = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = make_token(impostor)
    # The stub hands back the real public key regardless of the `kid`, so the
    # only thing that can reject this is the signature check itself.
    with pytest.raises(SupabaseAuthError):
        verify_token(token)

@pytest.mark.parametrize("token", ["", "   ", "not-a-jwt", "a.b", "a.b.c.d"])
def test_malformed_tokens_are_rejected(token):
    with pytest.raises(SupabaseAuthError):
        verify_token(token)

def test_missing_token_rejected():
    with pytest.raises(SupabaseAuthError, match="Authentication required"):
        verify_token(None)

def test_anonymous_role_is_treated_as_signed_out(jwks, signing_key):
    user = verify_token(make_token(signing_key, role="anonymous"))
    assert user.is_anonymous

def test_generated_key_is_only_ever_hashed():
    plaintext, prefix, digest = generate_api_key()
    assert plaintext.startswith("wck_")
    assert plaintext.startswith(prefix)
    assert len(plaintext) > len(prefix)
    assert digest == hash_api_key(plaintext)
    assert len(digest) == 64
    # The digest must not contain the secret it protects.
    assert plaintext not in digest

def test_two_generated_keys_differ():
    assert generate_api_key()[0] != generate_api_key()[0]

def test_publishable_key_is_not_treated_as_service_role():
    settings = _settings(service_role_key="sb_publishable_abc")
    assert not settings.has_service_role
    with SupabaseStore(settings) as store:
        with pytest.raises(SupabaseError, match="secret key"):
            store.select("profiles")

def test_secret_key_is_recognised():
    assert _settings(service_role_key="sb_secret_abc").has_service_role
    assert _settings(service_role_key="service_role").has_service_role

def test_health_config_reports_missing_env(monkeypatch):
    monkeypatch.setattr(sb, "SETTINGS", _settings(url="", anon_key=""))
    assert sb.is_configured() is False
    assert set(sb.missing_configuration()) == {"SUPABASE_URL", "SUPABASE_ANON_KEY"}

class StubStore:
    """Records what the API asked Postgres for and returns canned rows."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.keys: list[dict[str, Any]] = []
        self.searches: list[dict[str, Any]] = []
        self.credentials: dict[str, str] = {}

    # -- context manager plumbing
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return None

    def close(self):
        return None

    def select(self, table, **kwargs):
        self.calls.append(("select", {"table": table, **kwargs}))
        if table == "api_keys":
            return self.keys
        if table == "profiles":
            return [
                {
                    "id": "11111111-2222-3333-4444-555555555555",
                    "email": "user@example.com",
                    "full_name": "Test User",
                    "avatar_url": None,
                    "provider": "google",
                }
            ]
        if table == "user_credentials":
            return [{"ciphertext": "gAAAA", "id": kwargs.get("id", "cred-1")}]
        return []

    def insert(self, table, row, **kwargs):
        self.calls.append(("insert", {"table": table, "row": row}))
        if table == "api_keys":
            self.keys.append({**row, "id": "key-1", "revoked_at": None})
            return [self.keys[-1]]
        if table == "search_history":
            self.searches.append(row)
            return [{**row, "id": len(self.searches)}]
        return [row]

    def update(self, table, filters, values, **kwargs):
        self.calls.append(("update", {"table": table, "filters": filters, "values": values}))
        if table == "profiles":
            return [{**values, "id": "11111111-2222-3333-4444-555555555555"}]
        return []

    def delete(self, table, filters):
        self.calls.append(("delete", {"table": table, "filters": filters}))
        return None

    def rpc(self, name, payload):
        self.calls.append(("rpc", {"name": name, "payload": payload}))
        return "ciphertext" if name == "encrypt_credential" else "s3cret"

    # -- domain methods used by the routes
    def ensure_profile(self, user):
        self.calls.append(("ensure_profile", {"user_id": user.id}))
        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": None,
            "provider": user.provider,
        }

    def update_profile(self, user_id, values):
        self.calls.append(("update_profile", {"user_id": user_id, "values": values}))
        return [values]

    def list_searches(self, user_id, limit=25):
        self.calls.append(("list_searches", {"user_id": user_id, "limit": limit}))
        return self.searches[:limit]

    def record_search(self, user_id, row):
        self.calls.append(("record_search", {"user_id": user_id, "row": row}))
        self.searches.append({"user_id": user_id, **row})
        return {"user_id": user_id, **row}

    def clear_searches(self, user_id):
        self.calls.append(("clear_searches", {"user_id": user_id}))
        self.searches.clear()

    def list_api_keys(self, user_id):
        self.calls.append(("list_api_keys", {"user_id": user_id}))
        return self.keys

    def list_crawl_runs(self, user_id, limit=25):
        self.calls.append(("list_crawl_runs", {"user_id": user_id, "limit": limit}))
        return []

    def upsert_crawl_run(self, user_id, job):
        self.calls.append(("upsert_crawl_run", {"user_id": user_id, "job": job}))
        return job

    def list_credentials(self, user_id):
        self.calls.append(("list_credentials", {"user_id": user_id}))
        return []

    def create_api_key(self, user_id, name, scopes):
        self.calls.append(("create_api_key", {"user_id": user_id, "name": name, "scopes": scopes}))
        return {
            "id": "key-1",
            "name": name,
            "key_prefix": "wck_abc123",
            "scopes": scopes,
            "created_at": "2026-01-01T00:00:00Z",
            "last_used_at": None,
            "expires_at": None,
            "revoked_at": None,
            "key": "wck_the_only_time_you_see_this",
        }

    def revoke_api_key(self, user_id, key_id):
        self.calls.append(("revoke_api_key", {"user_id": user_id, "key_id": key_id}))

    def save_credential(self, user_id, *, label, provider, username, secret):
        self.calls.append(
            ("save_credential", {"user_id": user_id, "label": label, "secret": secret})
        )
        # Mirror the real store: pgcrypto encrypts before anything is written.
        self.rpc("encrypt_credential", {"plaintext": secret, "passphrase": "pass"})
        return {"id": "cred-1", "label": label, "provider": provider, "username": username}

    def read_credential(self, user_id, credential_id):
        self.calls.append(("read_credential", {"credential_id": credential_id}))
        return "s3cret"

    def delete_credential(self, user_id, credential_id):
        self.calls.append(("delete_credential", {"credential_id": credential_id}))

@pytest.fixture
def authed(monkeypatch, jwks, signing_key):
    """An app whose auth routes talk to a stubbed PostgREST layer."""
    stub = StubStore()
    monkeypatch.setattr("webcrawler.auth._store", lambda: stub)
    monkeypatch.setattr(
        sb,
        "SETTINGS",
        _settings(url=PROJECT_URL, service_role_key="sb_secret_test", credential_key="pass"),
    )
    with TemporaryDirectory() as tmp:
        app = create_app(Path(tmp))
        with TestClient(app) as c:
            yield c, stub, make_token(signing_key)

def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}

def test_me_returns_the_profile(authed):
    c, _stub, token = authed
    r = c.get("/api/me", headers=bearer(token))
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == "user@example.com"
    assert body["user"]["provider"] == "google"
    assert body["auth"]["email_confirmed"] is True

def test_me_rejects_an_unsigned_token(authed):
    c, _stub, _token = authed
    r = c.get("/api/me", headers=bearer("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig"))
    assert r.status_code == 401

def test_patch_me_updates_the_display_name(authed):
    c, stub, token = authed
    r = c.patch("/api/me", headers=bearer(token), json={"full_name": "New Name"})
    assert r.status_code == 200
    assert stub.calls[-1][1]["values"] == {"full_name": "New Name"}

def test_patch_me_rejects_an_empty_payload(authed):
    c, _stub, token = authed
    assert c.patch("/api/me", headers=bearer(token), json={}).status_code == 400

def test_api_key_is_returned_once_and_hashed_on_disk(authed):
    c, stub, token = authed
    r = c.post("/api/me/api-keys", headers=bearer(token), json={"name": "ci"})
    assert r.status_code == 200
    body = r.json()
    # The plaintext comes back exactly once, with a warning.
    assert body["key"] == "wck_the_only_time_you_see_this"
    assert "unrecoverable" in body["warning"]

    # Listing never contains the plaintext.
    listed = c.get("/api/me/api-keys", headers=bearer(token)).json()["items"]
    assert all("key" not in item for item in listed)

def test_api_key_scopes_are_validated(authed):
    c, _stub, token = authed
    r = c.post("/api/me/api-keys", headers=bearer(token), json={"scopes": ["delete-everything"]})
    assert r.status_code == 400

def test_api_key_can_be_revoked(authed):
    c, stub, token = authed
    r = c.delete("/api/me/api-keys/key-1", headers=bearer(token))
    assert r.status_code == 200
    expected = ("revoke_api_key", {"user_id": USER_ID, "key_id": "key-1"})
    assert expected in stub.calls

def test_history_round_trips(authed):
    c, stub, token = authed
    r = c.post(
        "/api/me/history",
        headers=bearer(token),
        json={"query": "vector search", "result_count": 7, "response_ms": 12},
    )
    assert r.status_code == 200
    assert stub.searches[-1]["query"] == "vector search"
    assert c.get("/api/me/history", headers=bearer(token)).status_code == 200

def test_history_requires_a_query(authed):
    c, _stub, token = authed
    assert c.post("/api/me/history", headers=bearer(token), json={}).status_code == 400

def test_credentials_are_encrypted_not_stored_plaintext(authed):
    c, stub, token = authed
    r = c.post(
        "/api/me/credentials",
        headers=bearer(token),
        json={"label": "github", "secret": "ghp_realtoken"},
    )
    assert r.status_code == 200
    # The response must not echo the secret back.
    assert "ghp_realtoken" not in r.text
    # pgcrypto did the encrypting; the plaintext only crossed the wire.
    rpc = [call for call in stub.calls if call[0] == "rpc"][0]
    assert rpc[1]["name"] == "encrypt_credential"
    assert rpc[1]["payload"]["plaintext"] == "ghp_realtoken"
    assert rpc[1]["payload"]["passphrase"] == "pass"

def test_credential_reveal_requires_the_server_passphrase(authed):
    c, _stub, token = authed
    r = c.get("/api/me/credentials/cred-1/secret", headers=bearer(token))
    assert r.status_code == 200
    assert r.json()["secret"] == "s3cret"

def test_credential_storage_disabled_without_passphrase(monkeypatch, jwks, signing_key):
    monkeypatch.setattr("webcrawler.auth._store", lambda: StubStore())
    monkeypatch.setattr(sb, "SETTINGS", _settings(url=PROJECT_URL, service_role_key="sb_secret_x"))
    with TemporaryDirectory() as tmp:
        with TestClient(create_app(Path(tmp))) as c:
            r = c.post(
                "/api/me/credentials",
                headers=bearer(make_token(signing_key)),
                json={"label": "x", "secret": "y"},
            )
    assert r.status_code == 503
    assert "WEBCRAWLER_CREDENTIAL_KEY" in r.json()["detail"]

def test_api_key_header_resolves_the_owner(monkeypatch, jwks, signing_key):
    stub = StubStore()
    stub.keys = [
        {
            "id": "key-1",
            "user_id": "user-42",
            "scopes": ["search", "crawl"],
            "revoked_at": None,
            "expires_at": None,
        }
    ]
    monkeypatch.setattr(
        sb, "SETTINGS", _settings(url=PROJECT_URL, service_role_key="sb_secret_test")
    )
    with TemporaryDirectory() as tmp:
        app = create_app(Path(tmp))
        with TestClient(app) as c:
            r = c.get("/api/auth/config", headers={"X-API-Key": "wck_anything"})
            # config is public, so the key is simply ignored there.
            assert r.status_code == 200

    # And through the real resolver the key maps back to its owner.
    from webcrawler.auth import _user_from_api_key

    class FakeRequest:
        headers = {"x-api-key": "wck_anything"}

    monkeypatch.setattr("webcrawler.auth._store", lambda: stub)
    user = _user_from_api_key(FakeRequest(), ("search",))
    assert user is not None
    assert user.id == "user-42"
    # last_used_at is bumped on use.
    assert any(call[0] == "update" for call in stub.calls)

def test_revoked_api_key_is_refused(monkeypatch, jwks):
    stub = StubStore()
    stub.keys = [
        {
            "id": "key-1",
            "user_id": "user-42",
            "scopes": ["search"],
            "revoked_at": "2026-01-01T00:00:00Z",
            "expires_at": None,
        }
    ]
    monkeypatch.setattr(
        sb, "SETTINGS", _settings(url=PROJECT_URL, service_role_key="sb_secret_test")
    )
    monkeypatch.setattr("webcrawler.auth._store", lambda: stub)
    from fastapi import HTTPException

    from webcrawler.auth import _user_from_api_key

    class FakeRequest:
        headers = {"x-api-key": "wck_anything"}

    with pytest.raises(HTTPException) as excinfo:
        _user_from_api_key(FakeRequest())
    assert excinfo.value.status_code == 401
    assert "revoked" in excinfo.value.detail

def test_api_key_missing_a_scope_is_forbidden(monkeypatch, jwks):
    stub = StubStore()
    stub.keys = [
        {
            "id": "key-1",
            "user_id": "user-42",
            "scopes": ["search"],
            "revoked_at": None,
            "expires_at": None,
        }
    ]
    monkeypatch.setattr(
        sb, "SETTINGS", _settings(url=PROJECT_URL, service_role_key="sb_secret_test")
    )
    monkeypatch.setattr("webcrawler.auth._store", lambda: stub)
    from fastapi import HTTPException

    from webcrawler.auth import _user_from_api_key

    class FakeRequest:
        headers = {"x-api-key": "wck_anything"}

    with pytest.raises(HTTPException) as excinfo:
        _user_from_api_key(FakeRequest(), ("crawl",))
    assert excinfo.value.status_code == 403
    assert "crawl" in excinfo.value.detail

def test_unknown_api_key_is_refused(monkeypatch, jwks):
    stub = StubStore()
    stub.keys = []
    monkeypatch.setattr(
        sb, "SETTINGS", _settings(url=PROJECT_URL, service_role_key="sb_secret_test")
    )
    monkeypatch.setattr("webcrawler.auth._store", lambda: stub)
    from fastapi import HTTPException

    from webcrawler.auth import _user_from_api_key

    class FakeRequest:
        headers = {"x-api-key": "wck_nope"}

    with pytest.raises(HTTPException) as excinfo:
        _user_from_api_key(FakeRequest())
    assert excinfo.value.status_code == 401
    assert "Unknown API key" in excinfo.value.detail

def test_no_credentials_means_no_caller():
    class FakeRequest:
        headers: dict[str, str] = {}

    assert authenticate(FakeRequest()) is None

def test_crawl_job_records_the_requesting_user(tmp_path):
    jobs = CrawlJobStore(tmp_path)
    jobs.create("job-1", "https://example.com", "example.com", "Queued", user_id="user-42")
    assert jobs.get("job-1")["user_id"] == "user-42"

    # A job created before this column existed still reads back as None.
    jobs.create("job-2", "https://example.org", "example.org", "Queued")
    assert jobs.get("job-2")["user_id"] is None

def test_crawl_job_user_id_survives_a_restart(tmp_path):
    first = CrawlJobStore(tmp_path)
    first.create("job-1", "https://example.com", "example.com", "Queued", user_id="user-42")
    assert CrawlJobStore(tmp_path).get("job-1")["user_id"] == "user-42"

def test_hash_is_stable_across_calls():
    assert hash_api_key("wck_abc") == hash_api_key("wck_abc")
    assert hash_api_key("wck_abc") != hash_api_key("wck_abd")

def test_settings_expose_derived_urls():
    settings = _settings(url="https://abc.supabase.co")
    assert settings.rest_url == "https://abc.supabase.co/rest/v1"
    assert settings.auth_url == "https://abc.supabase.co/auth/v1"
    assert settings.jwks_url == "https://abc.supabase.co/auth/v1/.well-known/jwks.json"
    assert settings.issuer == "https://abc.supabase.co/auth/v1"

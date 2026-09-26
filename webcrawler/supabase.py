"""Supabase configuration, JWT verification, and PostgREST data access.

Passwords are never handled here. Supabase Auth owns credentials; this module
only ever sees the resulting signed JWT.
"""

from __future__ import annotations

import hashlib
import logging
import os
import secrets
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

try:  # pragma: no cover - exercised implicitly by import
    import jwt
    from jwt import PyJWKClient
except ImportError:  # pragma: no cover
    jwt = None
    PyJWKClient = None

logger = logging.getLogger("webcrawler.supabase")

JWKS_CACHE_SECONDS = 3600
AUTH_AUDIENCE = "authenticated"
API_KEY_PREFIX = "wck"
GENERATED_KEY_BYTES = 32

def _load_dotenv() -> None:
    """Load a root .env file if python-dotenv is present. Never overrides real env."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    root = Path(__file__).resolve().parent.parent
    env_path = root / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=False)

def _clean(value: str | None) -> str:
    return (value or "").strip().strip('"').strip("'")

def _is_service_role(key: str) -> bool:
    return key.startswith("sb_secret_") or key.startswith("service_role")

@dataclass(frozen=True)
class SupabaseSettings:
    url: str
    anon_key: str
    service_role_key: str
    credential_key: str

    @property
    def rest_url(self) -> str:
        return f"{self.url}/rest/v1"

    @property
    def auth_url(self) -> str:
        return f"{self.url}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.auth_url}/.well-known/jwks.json"

    @property
    def issuer(self) -> str:
        return self.auth_url

    @property
    def has_service_role(self) -> bool:
        """A publishable key is RLS-bound, so admin writes through it fail
        loudly instead of appearing to succeed."""
        return bool(self.service_role_key) and _is_service_role(self.service_role_key)

    @property
    def can_encrypt_credentials(self) -> bool:
        return bool(self.credential_key)

_load_dotenv()

SETTINGS = SupabaseSettings(
    url=_clean(os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")),
    anon_key=_clean(
        os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    ),
    service_role_key=_clean(
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SECRET_KEY")
    ),
    credential_key=_clean(os.getenv("WEBCRAWLER_CREDENTIAL_KEY")),
)

def get_settings() -> SupabaseSettings:
    return SETTINGS

def is_configured() -> bool:
    """True when tokens can actually be verified."""
    return bool(SETTINGS.url and (SETTINGS.anon_key or SETTINGS.service_role_key))

def missing_configuration() -> list[str]:
    problems = []
    if not SETTINGS.url:
        problems.append("SUPABASE_URL")
    if not SETTINGS.anon_key and not SETTINGS.service_role_key:
        problems.append("SUPABASE_ANON_KEY")
    return problems

@dataclass
class _JWKSCache:
    client: Any = None
    fetched_at: float = 0.0
    error: str = ""

_jwks = _JWKSCache()

@dataclass(frozen=True)
class AuthUser:
    """The subset of claims this app is allowed to rely on."""

    id: str
    email: str
    role: str
    provider: str
    email_confirmed: bool
    full_name: str
    avatar_url: str
    claims: dict[str, Any] = field(default_factory=dict, repr=False, compare=False)

    @property
    def is_anonymous(self) -> bool:
        return self.role == "anonymous" or not self.id

class SupabaseAuthError(Exception):
    """Raised when a token is missing, malformed, expired, or not trusted."""

def _jwks_client() -> Any:
    """A PyJWKClient, refetched at most once an hour."""
    if PyJWKClient is None:
        raise SupabaseAuthError(
            "PyJWT[crypto] is not installed; run 'pip install -e .' to verify tokens."
        )
    now = time.monotonic()
    if _jwks.client is None or now - _jwks.fetched_at > JWKS_CACHE_SECONDS:
        try:
            _jwks.client = PyJWKClient(
                SETTINGS.jwks_url,
                cache_keys=True,
                lifespan=JWKS_CACHE_SECONDS,
                timeout=10,
            )
            _jwks.fetched_at = now
            _jwks.error = ""
        except Exception as exc:  # pragma: no cover - network dependent
            _jwks.error = str(exc)
            logger.warning("Could not prepare Supabase JWKS client: %s", exc)
    if _jwks.client is None:
        raise SupabaseAuthError(f"Supabase JWKS unavailable: {_jwks.error or 'unknown error'}")
    return _jwks.client

def decode_token(token: str) -> dict[str, Any]:
    """Verify signature, expiry, audience and issuer. Returns the claims."""
    if not SETTINGS.url:
        raise SupabaseAuthError(
            "Supabase is not configured; set SUPABASE_URL and SUPABASE_ANON_KEY."
        )
    token = token.strip()
    if not token:
        raise SupabaseAuthError("Missing access token")
    if token.count(".") != 2:
        raise SupabaseAuthError("Malformed access token")

    client = _jwks_client()
    try:
        signing_key = client.get_signing_key_from_jwt(token)
    except SupabaseAuthError:
        raise
    except Exception as exc:
        raise SupabaseAuthError(f"Access token signature could not be verified: {exc}") from exc

    try:
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=AUTH_AUDIENCE,
            issuer=SETTINGS.issuer,
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise SupabaseAuthError("Session expired, please sign in again") from exc
    except jwt.InvalidTokenError as exc:
        raise SupabaseAuthError(f"Invalid access token: {exc}") from exc

def user_from_claims(claims: dict[str, Any]) -> AuthUser:
    metadata = claims.get("user_metadata") or {}
    app_metadata = claims.get("app_metadata") or {}
    email = (claims.get("email") or metadata.get("email") or "").strip()
    subject = (claims.get("sub") or "").strip()
    if not subject:
        raise SupabaseAuthError("Access token has no subject")
    return AuthUser(
        id=subject,
        email=email,
        role=claims.get("role") or "authenticated",
        provider=app_metadata.get("provider") or "email",
        email_confirmed=bool(claims.get("email_confirmed_at") or email),
        full_name=(
            metadata.get("full_name")
            or metadata.get("name")
            or (email.split("@")[0] if email else "")
        ),
        avatar_url=metadata.get("avatar_url") or metadata.get("picture") or "",
        claims=claims,
    )

def verify_token(token: str | None) -> AuthUser:
    if not token:
        raise SupabaseAuthError("Authentication required")
    return user_from_claims(decode_token(token))

def generate_api_key() -> tuple[str, str, str]:
    """Return ``(plaintext, prefix, sha256_hex)``.

    The plaintext exists only in this return value; only the prefix and the
    hash are ever persisted.
    """
    raw = f"{API_KEY_PREFIX}_{secrets.token_urlsafe(GENERATED_KEY_BYTES)}"
    return raw, raw[: len(API_KEY_PREFIX) + 9], hash_api_key(raw)

def hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

class SupabaseError(Exception):
    """A PostgREST or Auth Admin call failed."""

    def __init__(self, message: str, status: int | None = None, payload: Any = None):
        super().__init__(message)
        self.status = status
        self.payload = payload

class SupabaseStore:
    """Thin PostgREST wrapper scoped to the service role key.

    Every method refuses to run without a service role key so a misconfigured
    deployment fails loudly instead of hitting RLS and losing writes.
    """

    def __init__(
        self,
        settings: SupabaseSettings | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        self.settings = settings or SETTINGS
        self._client = client
        self._owns_client = client is None

    def _require(self) -> None:
        if not self.settings.url:
            raise SupabaseError(
                "Supabase is not configured; set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
            )
        if not self.settings.has_service_role:
            raise SupabaseError(
                "SUPABASE_SERVICE_ROLE_KEY is missing or is not a secret key. "
                "The publishable key cannot write past RLS; create a secret key in "
                "Supabase -> Project Settings -> API Keys."
            )

    @property
    def client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(
                base_url=self.settings.rest_url,
                timeout=15.0,
                headers={
                    "apikey": self.settings.service_role_key,
                    "Authorization": f"Bearer {self.settings.service_role_key}",
                    "Content-Type": "application/json",
                },
            )
        return self._client

    def close(self) -> None:
        if self._client is not None and self._owns_client:
            self._client.close()
            self._client = None

    def __enter__(self) -> "SupabaseStore":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any = None,
        prefer: str | None = None,
    ) -> Any:
        self._require()
        headers = {"Prefer": prefer} if prefer else None
        try:
            response = self.client.request(method, path, params=params, json=json, headers=headers)
        except httpx.HTTPError as exc:
            raise SupabaseError(f"Supabase request failed: {exc}") from exc

        if response.status_code >= 400:
            raise SupabaseError(
                f"Supabase returned {response.status_code} for {method} {path}",
                status=response.status_code,
                payload=_safe_json(response),
            )
        if not response.content:
            return None
        return _safe_json(response)

    def select(
        self,
        table: str,
        *,
        columns: str = "*",
        filters: dict[str, Any] | None = None,
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"select": columns}
        for key, value in (filters or {}).items():
            params[key] = value
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)
        rows = self.request("GET", f"/{table}", params=params)
        return rows if isinstance(rows, list) else []

    def insert(self, table: str, row: dict[str, Any], *, upsert: bool = False) -> Any:
        prefer = (
            "resolution=merge-duplicates,return=representation"
            if upsert
            else "return=representation"
        )
        return self.request("POST", f"/{table}", json=row, prefer=prefer)

    def update(
        self,
        table: str,
        filters: dict[str, Any],
        values: dict[str, Any],
        *,
        returning: str = "representation",
    ) -> Any:
        return self.request(
            "PATCH", f"/{table}", params=filters, json=values, prefer=f"return={returning}"
        )

    def delete(self, table: str, filters: dict[str, Any]) -> Any:
        return self.request("DELETE", f"/{table}", params=filters)

    def rpc(self, name: str, payload: dict[str, Any]) -> Any:
        return self.request("POST", f"/rpc/{name}", json=payload)

    def ensure_profile(self, user: AuthUser) -> dict[str, Any]:
        """Fetch the profile row, inserting it if the trigger has not run yet."""
        rows = self.select(
            "profiles",
            columns="id,email,full_name,avatar_url,provider,confirmed_at,created_at",
            filters={"id": "eq.{user.id}", "limit": "1"},
        )
        if rows:
            profile = rows[0]
            touched = self._profile_updates(user)
            if touched:
                updated = self.update(
                    "profiles", {"id": "eq.{user.id}"}, touched, returning="representation"
                )
                if isinstance(updated, list) and updated:
                    profile = updated[0]
            return profile

        # Fallback for users who predate the trigger or a partial migration.
        row = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url or None,
            "provider": user.provider,
            "confirmed_at": user.claims.get("email_confirmed_at"),
        }
        try:
            created = self.insert("profiles", row, upsert=True)
        except SupabaseError as exc:
            # A concurrent request may have inserted first; re-read and continue.
            if exc.status == 409:
                existing = self.select(
                    "profiles",
                    columns="id,email,full_name,avatar_url,provider,confirmed_at,created_at",
                    filters={"id": "eq.{user.id}", "limit": "1"},
                )
                if existing:
                    return existing[0]
            raise
        if isinstance(created, list) and created:
            return created[0]
        return row

    @staticmethod
    def _profile_updates(user: AuthUser) -> dict[str, Any]:
        values: dict[str, Any] = {}
        if user.email:
            values["email"] = user.email
        if user.full_name:
            values["full_name"] = user.full_name
        if user.avatar_url:
            values["avatar_url"] = user.avatar_url
        return values

    def update_profile(self, user_id: str, values: dict[str, Any]) -> list[dict[str, Any]]:
        result = self.update("profiles", {"id": f"eq.{user_id}"}, values)
        return result if isinstance(result, list) else []

    def record_search(self, user_id: str, row: dict[str, Any]) -> dict[str, Any] | None:
        result = self.insert("search_history", {"user_id": user_id, **row})
        return result[0] if isinstance(result, list) and result else None

    def list_searches(self, user_id: str, limit: int = 25) -> list[dict[str, Any]]:
        return self.select(
            "search_history",
            columns="id,query,domain,result_count,response_ms,created_at",
            filters={"user_id": f"eq.{user_id}", "order": "created_at.desc"},
            order="created_at.desc",
            limit=limit,
        )

    def clear_searches(self, user_id: str) -> None:
        self.delete("search_history", {"user_id": f"eq.{user_id}"})

    def upsert_crawl_run(self, user_id: str, job: dict[str, Any]) -> dict[str, Any] | None:
        result = self.insert("crawl_runs", {"user_id": user_id, **job}, upsert=True)
        return result[0] if isinstance(result, list) and result else None

    def list_crawl_runs(self, user_id: str, limit: int = 25) -> list[dict[str, Any]]:
        return self.select(
            "crawl_runs",
            columns="id,target,host,status,progress,pages_found,pages_stored,message,error,created_at,finished_at",
            filters={"user_id": f"eq.{user_id}", "order": "created_at.desc"},
            order="created_at.desc",
            limit=limit,
        )

    def create_api_key(self, user_id: str, name: str, scopes: list[str]) -> dict[str, Any]:
        plaintext, prefix, digest = generate_api_key()
        row = {
            "user_id": user_id,
            "name": name,
            "key_prefix": prefix,
            "key_hash": digest,
            "scopes": scopes,
        }
        result = self.insert("api_keys", row)
        created = result[0] if isinstance(result, list) and result else row
        # The plaintext is handed back exactly once and never stored.
        return {**created, "key": plaintext}

    def list_api_keys(self, user_id: str) -> list[dict[str, Any]]:
        return self.select(
            "api_keys",
            columns="id,name,key_prefix,scopes,last_used_at,expires_at,revoked_at,created_at",
            filters={"user_id": f"eq.{user_id}", "order": "created_at.desc"},
            order="created_at.desc",
        )

    def revoke_api_key(self, user_id: str, key_id: str) -> None:
        self.update(
            "api_keys",
            {"id": f"eq.{key_id}", "user_id": f"eq.{user_id}"},
            {"revoked_at": "now()"},
        )

    def save_credential(
        self,
        user_id: str,
        *,
        label: str,
        provider: str | None,
        username: str | None,
        secret: str,
    ) -> dict[str, Any]:
        ciphertext = self.rpc(
            "encrypt_credential", {"plaintext": secret, "passphrase": self.settings.credential_key}
        )
        row = {
            "user_id": user_id,
            "label": label,
            "provider": provider or None,
            "username": username or None,
            "ciphertext": ciphertext,
        }
        result = self.insert("user_credentials", row, upsert=True)
        created = result[0] if isinstance(result, list) and result else row
        return {k: v for k, v in created.items() if k != "ciphertext"}

    def list_credentials(self, user_id: str) -> list[dict[str, Any]]:
        return self.select(
            "user_credentials",
            columns="id,label,provider,username,created_at,updated_at",
            filters={"user_id": f"eq.{user_id}", "order": "created_at.desc"},
            order="created_at.desc",
        )

    def read_credential(self, user_id: str, credential_id: str) -> str:
        rows = self.select(
            "user_credentials",
            columns="id,ciphertext",
            filters={"id": f"eq.{credential_id}", "user_id": f"eq.{user_id}", "limit": "1"},
        )
        if not rows:
            raise SupabaseError("Credential not found", status=404)
        plaintext = self.rpc(
            "decrypt_ciphertext",
            {"ciphertext": rows[0]["ciphertext"], "passphrase": self.settings.credential_key},
        )
        if not isinstance(plaintext, str):
            raise SupabaseError("Credential could not be decrypted", status=422)
        return plaintext

    def delete_credential(self, user_id: str, credential_id: str) -> None:
        self.delete("user_credentials", {"id": f"eq.{credential_id}", "user_id": f"eq.{user_id}"})

def _safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return {"error": response.text[:500]}

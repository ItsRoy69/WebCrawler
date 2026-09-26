"""Supabase-backed auth and per-user storage routes.

Sign-up, sign-in, Google and GitHub all happen in the browser through
``@supabase/supabase-js``. This module verifies the resulting access token,
reads and writes the caller's rows through the service role key, and manages
developer API keys, which are stored only as a SHA-256 hash.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from .supabase import (
    AuthUser,
    SupabaseAuthError,
    SupabaseError,
    SupabaseStore,
    get_settings,
    hash_api_key,
    is_configured,
    missing_configuration,
    verify_token,
)

logger = logging.getLogger("webcrawler.auth")

API_KEY_SCOPES = ("search", "crawl")

def _store() -> SupabaseStore:
    return SupabaseStore()

def _unavailable(exc: SupabaseError) -> HTTPException:
    logger.warning("Supabase storage unavailable: %s", exc)
    return HTTPException(503, str(exc))

def _not_found(message: str) -> HTTPException:
    return HTTPException(404, message)

def _bearer(request: Request) -> str | None:
    header = request.headers.get("authorization") or ""
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return None

def _current_user(request: Request) -> AuthUser:
    token = _bearer(request)
    if not token:
        raise HTTPException(401, "Sign in to use this endpoint")
    try:
        user = verify_token(token)
    except SupabaseAuthError as exc:
        raise HTTPException(401, str(exc)) from exc
    if user.is_anonymous:
        raise HTTPException(401, "Anonymous sessions cannot access this endpoint")
    return user

def _optional_user(request: Request) -> AuthUser | None:
    token = _bearer(request) or request.headers.get("x-api-key")
    if not token:
        return None
    try:
        user = verify_token(token)
    except SupabaseAuthError:
        return None
    return None if user.is_anonymous else user

def _user_from_api_key(request: Request, required_scopes: tuple[str, ...] = ()) -> AuthUser | None:
    """Resolve a developer API key to its owner.

    Returns ``None`` when no key was supplied so callers can fall back to
    bearer auth. Raises 401/403 for a key that is present but not usable.
    """
    raw = request.headers.get("x-api-key")
    if not raw:
        return None

    settings = get_settings()
    if not settings.has_service_role:
        raise _unavailable(
            SupabaseError("API key authentication needs SUPABASE_SERVICE_ROLE_KEY")
        )

    digest = hash_api_key(raw.strip())
    try:
        with _store() as store:
            rows = store.select(
                "api_keys",
                columns="id,user_id,scopes,revoked_at,expires_at",
                filters={"key_hash": f"eq.{digest}", "limit": "1"},
            )
            if not rows:
                raise HTTPException(401, "Unknown API key")
            key = rows[0]
            if key.get("revoked_at"):
                raise HTTPException(401, "This API key has been revoked")
            if key.get("expires_at") and key["expires_at"] < _now_iso():
                raise HTTPException(401, "This API key has expired")

            missing = set(required_scopes) - set(key.get("scopes") or [])
            if missing:
                needed = ", ".join(sorted(missing))
                raise HTTPException(403, f"API key is missing scope(s): {needed}")

            store.update(
                "api_keys",
                {"id": f"eq.{key['id']}"},
                {"last_used_at": "now()"},
                returning="minimal",
            )
            profile_rows = store.select(
                "profiles",
                columns="id,email,full_name,avatar_url,provider",
                filters={"id": f"eq.{key['user_id']}", "limit": "1"},
            )
    except SupabaseError as exc:
        raise _unavailable(exc) from exc

    profile = profile_rows[0] if profile_rows else {}
    return AuthUser(
        id=key["user_id"],
        email=profile.get("email", ""),
        role="authenticated",
        provider=profile.get("provider", "email"),
        email_confirmed=True,
        full_name=profile.get("full_name") or "",
        avatar_url=profile.get("avatar_url") or "",
    )

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def authenticate(request: Request, scopes: tuple[str, ...] = ()) -> AuthUser | None:
    """Bearer session first, developer API key second, otherwise ``None``."""
    return _optional_user(request) or _user_from_api_key(request, scopes)

def build_auth_router() -> tuple[APIRouter, APIRouter]:
    """Return ``(/api/auth router, /api/me router)``."""
    router = APIRouter(prefix="/api/auth", tags=["auth"])
    me = APIRouter(prefix="/api/me", tags=["auth"])

    @router.get("/config")
    def auth_config() -> dict[str, Any]:
        settings = get_settings()
        return {
            "configured": is_configured(),
            "missing": missing_configuration(),
            "url": settings.url,
            "storage_ready": settings.has_service_role,
            "credential_encryption": settings.can_encrypt_credentials,
            "providers": ["email", "google", "github"],
            "scopes": list(API_KEY_SCOPES),
        }

    @me.get("")
    def read_me(request: Request) -> dict[str, Any]:
        user = _current_user(request)
        try:
            with _store() as store:
                profile = store.ensure_profile(user)
        except SupabaseError as exc:
            # A missing table or bad key means the migration has not been run.
            # Both are deployment faults, not user errors.
            raise _unavailable(exc) from exc
        return {"user": _public_profile(user, profile), "auth": _auth_metadata(user)}

    @me.patch("")
    async def update_me(request: Request) -> dict[str, Any]:
        user = _current_user(request)
        body = await _json_body(request)
        values: dict[str, Any] = {}
        full_name = body.get("full_name")
        if isinstance(full_name, str):
            values["full_name"] = full_name.strip()[:120] or None
        avatar = body.get("avatar_url")
        if isinstance(avatar, str) and avatar.startswith(("http://", "https://")):
            values["avatar_url"] = avatar[:500]
        if not values:
            raise HTTPException(400, "Nothing to update")
        try:
            with _store() as store:
                rows = store.update_profile(user.id, values)
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {"user": _public_profile(user, rows[0] if rows else {})}

    @me.get("/history")
    def read_history(request: Request, limit: int = Query(25, ge=1, le=100)) -> dict[str, Any]:
        user = _current_user(request)
        try:
            with _store() as store:
                rows = store.list_searches(user.id, limit=limit)
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {"items": rows}

    @me.post("/history")
    async def write_history(request: Request) -> dict[str, Any]:
        user = _current_user(request)
        body = await _json_body(request)
        query = str(body.get("query") or "").strip()
        if not query:
            raise HTTPException(400, "query is required")
        row = {
            "query": query[:512],
            "domain": (str(body["domain"])[:253] if body.get("domain") else None),
            "result_count": _as_int(body.get("result_count"), 0),
            "response_ms": _as_int(body.get("response_ms"), 0) or None,
        }
        try:
            with _store() as store:
                saved = store.record_search(user.id, row)
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {"saved": bool(saved), "item": saved}

    @me.delete("/history")
    def clear_history(request: Request) -> dict[str, Any]:
        user = _current_user(request)
        try:
            with _store() as store:
                store.clear_searches(user.id)
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {"status": "ok"}

    @me.get("/crawls")
    def read_crawls(request: Request, limit: int = Query(25, ge=1, le=100)) -> dict[str, Any]:
        user = _current_user(request)
        try:
            with _store() as store:
                rows = store.list_crawl_runs(user.id, limit=limit)
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {"items": rows}

    @me.post("/crawls")
    async def write_crawl(request: Request) -> dict[str, Any]:
        user = _current_user(request)
        body = await _json_body(request)
        job_id = str(body.get("id") or "").strip()[:64]
        target = str(body.get("target") or "").strip()[:2000]
        if not job_id or not target:
            raise HTTPException(400, "id and target are required")
        row = {
            "id": job_id,
            "target": target,
            "host": (str(body.get("host") or "")[:253] or None),
            "status": str(body.get("status") or "queued")[:32],
            "progress": _as_int(body.get("progress"), 0),
            "pages_found": _as_int(body.get("pages_found"), 0),
            "pages_stored": _as_int(body.get("pages_stored"), 0),
            "message": str(body.get("message") or "")[:500],
            "error": (str(body["error"])[:500] if body.get("error") else None),
            "finished_at": body.get("finished_at"),
        }
        try:
            with _store() as store:
                saved = store.upsert_crawl_run(user.id, row)
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {"saved": bool(saved), "item": saved}

    @me.get("/api-keys")
    def read_api_keys(request: Request) -> dict[str, Any]:
        user = _current_user(request)
        try:
            with _store() as store:
                rows = store.list_api_keys(user.id)
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {"items": rows}

    @me.post("/api-keys")
    async def create_api_key(request: Request) -> dict[str, Any]:
        user = _current_user(request)
        body = await _json_body(request)
        name = str(body.get("name") or "default").strip()[:60] or "default"
        requested = body.get("scopes")
        scopes = [s for s in (requested or API_KEY_SCOPES) if s in API_KEY_SCOPES]
        if not scopes:
            raise HTTPException(400, f"scopes must be a subset of {list(API_KEY_SCOPES)}")
        try:
            with _store() as store:
                created = store.create_api_key(user.id, name, scopes)
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {
            "item": created,
            "key": created["key"],
            "warning": "Copy this key now. Once you close this, it is unrecoverable.",
        }

    @me.delete("/api-keys/{key_id}")
    def revoke_api_key(key_id: str, request: Request) -> dict[str, Any]:
        user = _current_user(request)
        try:
            with _store() as store:
                store.revoke_api_key(user.id, key_id)
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {"status": "ok", "revoked": key_id}

    @me.get("/credentials")
    def read_credentials(request: Request) -> dict[str, Any]:
        user = _current_user(request)
        try:
            with _store() as store:
                rows = store.list_credentials(user.id)
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {"items": rows}

    @me.post("/credentials")
    async def create_credential(request: Request) -> dict[str, Any]:
        user = _current_user(request)
        _require_credential_key()
        body = await _json_body(request)
        label = str(body.get("label") or "").strip()[:80]
        secret = str(body.get("secret") or "")
        if not label or not secret:
            raise HTTPException(400, "label and secret are required")
        try:
            with _store() as store:
                created = store.save_credential(
                    user.id,
                    label=label,
                    provider=str(body.get("provider") or "")[:60] or None,
                    username=str(body.get("username") or "")[:200] or None,
                    secret=secret,
                )
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {"item": created}

    @me.get("/credentials/{credential_id}/secret")
    def reveal_credential(credential_id: str, request: Request) -> dict[str, Any]:
        user = _current_user(request)
        _require_credential_key()
        try:
            with _store() as store:
                secret = store.read_credential(user.id, credential_id)
        except SupabaseError as exc:
            if exc.status == 404:
                raise _not_found("Credential not found") from exc
            raise _unavailable(exc) from exc
        return {"secret": secret}

    @me.delete("/credentials/{credential_id}")
    def remove_credential(credential_id: str, request: Request) -> dict[str, Any]:
        user = _current_user(request)
        try:
            with _store() as store:
                store.delete_credential(user.id, credential_id)
        except SupabaseError as exc:
            raise _unavailable(exc) from exc
        return {"status": "ok", "deleted": credential_id}

    return router, me

async def _json_body(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Request body must be JSON") from exc
    if not isinstance(payload, dict):
        raise HTTPException(400, "Request body must be a JSON object")
    return payload

def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

def _require_credential_key() -> None:
    if not get_settings().can_encrypt_credentials:
        raise HTTPException(
            503,
            "Credential storage needs WEBCRAWLER_CREDENTIAL_KEY set on the server.",
        )

def _public_profile(user: AuthUser, profile: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": profile.get("email") or user.email,
        "full_name": profile.get("full_name") or user.full_name,
        "avatar_url": profile.get("avatar_url") or user.avatar_url,
        "provider": profile.get("provider") or user.provider,
        "created_at": profile.get("created_at"),
        "confirmed_at": profile.get("confirmed_at"),
    }

def _auth_metadata(user: AuthUser) -> dict[str, Any]:
    return {
        "role": user.role,
        "email_confirmed": user.email_confirmed,
        "expires_at": user.claims.get("exp"),
    }

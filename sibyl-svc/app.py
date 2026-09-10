"""Stash × Sibyl memory sidecar.

Sibyl Memory is a Python library with no JS SDK and no hosted API, so this small
service is the TS↔Sibyl boundary. Stash's browser never calls it directly: the
Vercel function proxies, so the service token stays server-side (same pattern the
retired api/og-sync.ts used for 0G).

Auth today is a single service token plus a caller-supplied tenant, which means
any holder of the token can read or write ANY tenant. That is closed by SIWE
(wallet-signed, verified here) when wallet-connect lands. It must not ship to
judging as-is.

The token arrives in `X-Stash-Auth`, NOT `Authorization`. A private Hugging Face
Space reserves `Authorization: Bearer <hf token>` for its own gate, so using that
header for the service token would collide and lock us out of our own app. The
`Authorization` form is still accepted so a proxy mid-rollout keeps working.
"""

from __future__ import annotations

import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from gateway import CATEGORIES, CategoryError, Gateway, TenantError, normalize_tenant
from persist import Persister, store_from_env

# Load sibyl-svc/.env if it exists, resolved relative to THIS file rather than the
# working directory, so the service starts the same way from anywhere. Real
# environment variables already set always win (override=False), which keeps a
# deployed host's secrets authoritative over any file that ships beside the code.
load_dotenv(Path(__file__).with_name(".env"), override=False)

DB_PATH = os.getenv("SIBYL_DB_PATH", os.path.expanduser("~/.sibyl-memory/memory.db"))
SVC_TOKEN = os.getenv("STASH_SVC_TOKEN", "")

if not SVC_TOKEN:
    # Fail closed. An open memory service is worse than a down one.
    raise RuntimeError("STASH_SVC_TOKEN is required: refusing to start unauthenticated")

SVC_TOKEN_BYTES = SVC_TOKEN.encode("utf-8")

# Restore BEFORE the Gateway opens the database: SQLite must not hold the file
# open while it is being replaced. A missing or failed snapshot is not fatal, the
# service just starts with empty memory (see Persister.restore).
persister = Persister(
    DB_PATH,
    store_from_env(),
    debounce_s=float(os.getenv("SIBYL_SNAPSHOT_DEBOUNCE_S", "20")),
)
persister.restore()

gateway = Gateway(DB_PATH)


@asynccontextmanager
async def lifespan(_: FastAPI):
    persister.start()
    try:
        yield
    finally:
        # Graceful shutdown (SIGTERM on a redeploy) flushes the debounce window,
        # so a pending write is not lost to the restart that triggered it.
        persister.close()


app = FastAPI(
    title="stash-sibyl-svc",
    version="0.2.0",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)


def require_tenant(
    x_stash_auth: str = Header(default=""),
    authorization: str = Header(default=""),
    x_stash_tenant: str = Header(default=""),
) -> str:
    """Verify the service token, then resolve the tenant. Constant-time compare.

    `X-Stash-Auth` is the header to use. `Authorization: Bearer …` is accepted as
    a fallback so the proxy can be rolled forward independently of this service,
    but it collides with a private Space's own gate, so it is not the default.
    """
    presented = x_stash_auth.strip()
    if not presented:
        scheme, _, bearer = authorization.partition(" ")
        if scheme.lower() == "bearer":
            presented = bearer.strip()
    # Compare as bytes: compare_digest raises TypeError on a non-ASCII str, which
    # would turn a malformed header into a 500 instead of a 401.
    if not secrets.compare_digest(presented.encode("utf-8", "replace"), SVC_TOKEN_BYTES):
        raise HTTPException(status_code=401, detail="bad or missing service token")
    try:
        return normalize_tenant(x_stash_tenant)
    except TenantError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


Tenant = Depends(require_tenant)


class EntityIn(BaseModel):
    category: str = Field(description=f"one of: {', '.join(CATEGORIES)}")
    name: str
    body: dict[str, Any] | list[Any]


class SnapshotIn(BaseModel):
    body: dict[str, Any]


class EventIn(BaseModel):
    evaluated: Any = None
    acted: Any = None
    forward: Any = None
    extra: Any = None
    ts: str | None = None


class ArchiveIn(BaseModel):
    category: str
    name: str
    reason: str | None = None


def _guard(fn, *args, **kwargs):
    """Map the gateway's validation errors onto 400s."""
    try:
        return fn(*args, **kwargs)
    except (TenantError, CategoryError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _wrote(result):
    """Mark the database dirty after a successful mutation, then pass the result through.

    Only reached when `_guard` did not raise, so a rejected write never schedules a
    snapshot. Snapshotting is debounced and never raises, so this cannot fail a write.
    """
    persister.mark_dirty()
    return result


@app.get("/healthz")
def healthz() -> dict:
    """Unauthenticated liveness only: no tenant data, no counts."""
    return {"ok": True, "service": "stash-sibyl-svc"}


@app.get("/recall-pack")
def recall_pack(tenant: str = Tenant, events: int = 10) -> dict:
    return _guard(gateway.recall_pack, tenant, events=max(0, min(events, 50)))


@app.post("/entity")
def set_entity(payload: EntityIn, tenant: str = Tenant) -> dict:
    return _wrote(
        _guard(gateway.set_entity, tenant, payload.category, payload.name, payload.body)
    )


@app.get("/entity")
def get_entity(category: str, name: str, tenant: str = Tenant) -> dict:
    row = _guard(gateway.get_entity, tenant, category, name)
    if row is None:
        raise HTTPException(status_code=404, detail="no such entity")
    return row


@app.get("/entities")
def list_entities(
    category: str | None = None, q: str | None = None, limit: int = 100, tenant: str = Tenant
) -> dict:
    limit = max(1, min(limit, 200))
    if q:
        return {"results": _guard(gateway.search, tenant, q, limit)}
    return {"results": _guard(gateway.list_entities, tenant, category, limit)}


@app.post("/archive")
def archive_entity(payload: ArchiveIn, tenant: str = Tenant) -> dict:
    return _wrote(
        _guard(gateway.archive_entity, tenant, payload.category, payload.name, payload.reason)
    )


@app.post("/state")
def set_snapshot(payload: SnapshotIn, tenant: str = Tenant) -> dict:
    _guard(gateway.set_snapshot, tenant, payload.body)
    return _wrote({"ok": True})


@app.get("/state")
def get_snapshot(tenant: str = Tenant) -> dict:
    return {"snapshot": _guard(gateway.get_snapshot, tenant)}


@app.post("/event")
def write_event(payload: EventIn, tenant: str = Tenant) -> dict:
    event_id = _guard(
        gateway.write_event,
        tenant,
        evaluated=payload.evaluated,
        acted=payload.acted,
        forward=payload.forward,
        extra=payload.extra,
        ts=payload.ts,
    )
    return _wrote({"id": event_id})


@app.get("/events")
def read_events(limit: int = 50, since: str | None = None, tenant: str = Tenant) -> dict:
    return {"events": _guard(gateway.read_events, tenant, limit=max(1, min(limit, 200)), since=since)}


@app.get("/tier")
def tier_status(tenant: str = Tenant) -> dict:
    """Storage headroom + server-verified tier. Used to keep the README honest."""
    return _guard(gateway.tier_status, tenant)


# --- durability ------------------------------------------------------------
# Memory lives in one SQLite file, and an ephemeral host wipes it on every
# restart. These two routes make that layer observable and forceable rather than
# something you find out about when a tenant silently stops being remembered.


@app.get("/persistence")
def persistence_status(tenant: str = Tenant) -> dict:
    """Snapshot backend, boot outcome and last error. No tenant data."""
    return persister.status()


@app.post("/snapshot")
def force_snapshot(tenant: str = Tenant) -> dict:
    """Snapshot now, synchronously. Run it before a redeploy, or from the demo
    script, instead of trusting the debounce window."""
    ok = persister.flush()
    if not ok and persister.last_error:
        raise HTTPException(status_code=503, detail=persister.last_error)
    return {"ok": ok, **persister.status()}

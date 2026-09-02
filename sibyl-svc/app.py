"""Stash × Sibyl memory sidecar.

Sibyl Memory is a Python library with no JS SDK and no hosted API, so this small
service is the TS↔Sibyl boundary. Stash's browser never calls it directly: the
Vercel function proxies, so the service token stays server-side (same pattern the
retired api/og-sync.ts used for 0G).

Auth today is a single service token plus a caller-supplied tenant, which means
any holder of the token can read or write ANY tenant. That is closed by SIWE
(wallet-signed, verified here) when wallet-connect lands. It must not ship to
judging as-is.
"""

from __future__ import annotations

import os
import secrets
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from gateway import CATEGORIES, CategoryError, Gateway, TenantError, normalize_tenant

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

gateway = Gateway(DB_PATH)
app = FastAPI(title="stash-sibyl-svc", version="0.1.0", docs_url=None, redoc_url=None)


def require_tenant(
    authorization: str = Header(default=""),
    x_stash_tenant: str = Header(default=""),
) -> str:
    """Verify the service token, then resolve the tenant. Constant-time compare."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(token, SVC_TOKEN):
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


@app.get("/healthz")
def healthz() -> dict:
    """Unauthenticated liveness only: no tenant data, no counts."""
    return {"ok": True, "service": "stash-sibyl-svc"}


@app.get("/recall-pack")
def recall_pack(tenant: str = Tenant, events: int = 10) -> dict:
    return _guard(gateway.recall_pack, tenant, events=max(0, min(events, 50)))


@app.post("/entity")
def set_entity(payload: EntityIn, tenant: str = Tenant) -> dict:
    return _guard(gateway.set_entity, tenant, payload.category, payload.name, payload.body)


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
    return _guard(gateway.archive_entity, tenant, payload.category, payload.name, payload.reason)


@app.post("/state")
def set_snapshot(payload: SnapshotIn, tenant: str = Tenant) -> dict:
    _guard(gateway.set_snapshot, tenant, payload.body)
    return {"ok": True}


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
    return {"id": event_id}


@app.get("/events")
def read_events(limit: int = 50, since: str | None = None, tenant: str = Tenant) -> dict:
    return {"events": _guard(gateway.read_events, tenant, limit=max(1, min(limit, 200)), since=since)}


@app.get("/tier")
def tier_status(tenant: str = Tenant) -> dict:
    """Storage headroom + server-verified tier. Used to keep the README honest."""
    return _guard(gateway.tier_status, tenant)

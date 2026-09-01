# stash-sibyl-svc

The TS↔Sibyl boundary. [Sibyl Memory](https://github.com/Sibyl-Labs/Sibyl-Memory) is a
Python library over a local SQLite file (no JS SDK, no hosted API), so Stash reaches it
through this small FastAPI service.

## Shape

One activated Sibyl **account** (the service) holds many **tenants**; a tenant is an end
user's wallet address, lowercased. The account carries the tier and the storage cap; the
tenant carries the isolation. They are separate layers and the README's critical-path
section should keep them separate.

| Stash concept | Sibyl tier | Call |
|---|---|---|
| identity · goal · habit · preference · opportunity | WARM entity | `set_entity(category, name, body)` |
| consolidated financial snapshot | HOT state | `set_state("financial_snapshot", …)` |
| income / expense events | COLD journal | `write_event(…)` |
| dropped goals and memories | ARCHIVE | `archive_entity(…)` |

Entity names are slugified, so "MacBook Pro" and "macbook pro" hit the same row.
Combined with Sibyl's `UNIQUE(tenant_id, category, name)`, re-writing an entity
**consolidates** into the existing row rather than forking a second memory.

## Endpoints

Every route except `/healthz` needs `Authorization: Bearer $STASH_SVC_TOKEN` and
`X-Stash-Tenant: 0x…`.

```
GET  /healthz       liveness only, no tenant data
GET  /recall-pack   ONE round-trip for the cold-start opener
POST /entity        write (or consolidate) a memory
GET  /entity        ?category=&name=
GET  /entities      ?category= | ?q=  (FTS5, not semantic)
POST /archive       retire an entity
POST /state         write the financial snapshot
GET  /state         read it
POST /event         journal a money event
GET  /events        ?limit=&since=
GET  /tier          server-verified tier + storage headroom
```

`/recall-pack` returns `remembers: false` when a tenant has nothing stored. The client
must render a plain greeting in that case: never a blank screen, and never content that
only exists if the fetch succeeds.

## Run it locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export STASH_SVC_TOKEN=$(python3 -c "import secrets;print(secrets.token_urlsafe(24))")
export SIBYL_DB_PATH=/tmp/stash-memory.db
.venv/bin/uvicorn app:app --port 8787

# in another shell, same STASH_SVC_TOKEN exported:
.venv/bin/python probe.py http://127.0.0.1:8787
```

`probe.py` is the end-to-end proof: auth rejection, tenant isolation, consolidation
(same row id, evolved body), HOT/COLD round-trips, FTS, and a full `/recall-pack`.

## Two honest ceilings

**Auth.** Today's model is one shared service token plus a caller-supplied tenant, so any
holder of the token can read or write *any* tenant. The token never reaches the browser,
since Stash's serverless function proxies. But this is not real per-user auth. SIWE (wallet
signature, verified here) closes it when wallet-connect lands.

**Storage.** The free tier caps the account at 5,242,880 bytes, and the cap is measured
per **account** across every store on the machine, so splitting into one db per wallet
would not buy headroom. An empty schema already occupies ~283 KB (FTS5 tables), leaving
roughly 4.96 MB for real data: plenty at demo scale, and the ceiling to name out loud.

A deployed host needs a **persistent volume**; container-local disks are wiped on
redeploy and the memory would go with them.

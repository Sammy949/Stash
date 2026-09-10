---
title: Stash Sibyl Memory
emoji: 🧠
colorFrom: indigo
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
short_description: Encrypted financial memory sidecar for Stash
---

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

Every route except `/healthz` needs `X-Stash-Auth: $STASH_SVC_TOKEN` and
`X-Stash-Tenant: 0x…`.

The service token is **not** in `Authorization`. A private Hugging Face Space
reserves `Authorization: Bearer <hf token>` for its own gate, so putting ours
there would collide and lock the proxy out of its own app. `Authorization:
Bearer` is still accepted as a fallback so the proxy and the service can be
rolled forward independently, and `probe.py` covers both.

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
GET  /persistence   snapshot backend, boot outcome, last error
POST /snapshot      snapshot NOW, synchronously (run before a redeploy)
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

## Durability on an ephemeral host

Memory is one SQLite file. A free Hugging Face Space wipes container-local disk on every
restart, sleep-wake and rebuild, and losing it fails *quietly*: `/recall-pack` just returns
`remembers: false`, which is indistinguishable from a brand-new tenant.

`persist.py` closes that. Set a private dataset repo and a write-scoped token:

```
SIBYL_SNAPSHOT_REPO=your-username/stash-memory
SIBYL_SNAPSHOT_HF_TOKEN=hf_...
SIBYL_SNAPSHOT_DEBOUNCE_S=20
```

and the service restores on boot and snapshots after every write. Offline alternative with
no token and no network: `SIBYL_SNAPSHOT_DIR=/some/dir`. With none of them set the service
still runs, disk-only, and `/persistence` says so.

Three things it is careful about:

- **`VACUUM INTO`, never a file copy.** In WAL mode the committed rows sit in
  `memory.db-wal`; mid-flight the main file is a 4 KB stub. Measured on a live service:
  `memory.db=4096B`, `memory.db-wal=898192B`. Copying `memory.db` would back up nothing.
- **The restored file is never a symlink.** Sibyl's `Storage` refuses to open a symlinked
  database, and the Hub cache is built from symlinks into `blobs/`. Restore downloads to a
  scratch dir and `copyfile`s to the real path.
- **A snapshot never clobbers live local state.** Restore only fires when there is no
  usable database on disk, so on a host with a real volume the local file always wins.

The debounce window is the worst-case loss on a *hard* kill. A graceful stop (SIGTERM on
redeploy) flushes it, and `POST /snapshot` forces it. Note the windows cannot collide with a
host's idle spin-down: that needs ~15 minutes of silence, the debounce is seconds.

Deployed to **Render free** (`deploy/RENDER.md`, blueprint in `render.yaml` at the repo
root), with a private HF **dataset** as the snapshot store. `deploy/HUGGINGFACE.md` covers
hosting on a Space, which needs PRO and is not the current plan.

```bash
STASH_SVC_TOKEN=$STASH_SVC_TOKEN .venv/bin/python verify_persistence.py
```

boots the real service, writes real memory, deletes the whole database directory the way a
container wipe does, boots again on an empty disk and asserts `/recall-pack` comes back
identical, FTS index included. Export `SIBYL_SNAPSHOT_REPO` + `SIBYL_SNAPSHOT_HF_TOKEN`
first to run the same cycle against the real dataset.

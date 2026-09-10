# Deploying the memory sidecar to Render (free tier)

The free tier has an **ephemeral filesystem** and **cannot attach a disk**, which
used to disqualify it: `memory.db` is the whole product. `persist.py` removes that
constraint by snapshotting to a private Hugging Face dataset, so the container is
free to be as disposable as Render wants it to be.

`render.yaml` at the repo root is the blueprint. Read that first; this file is the
part that is not machine-readable.

## The two numbers that decide everything

**Spin-down: ~15 minutes idle, ~50s to boot.** Your data is safe across it, and
not by luck — spin-down needs 15 minutes of silence while the snapshot debounce is
5 seconds, so any write is flushed ~14.9 minutes before a spin-down can even
begin. The two windows cannot overlap. The 20s-vs-5s debounce only matters for a
hard kill mid-traffic, which spin-down is not.

**750 instance-hours per workspace per month.** A 31-day month is 744 hours, so
one always-awake service fits with **6 hours to spare and room for zero other
free services**. Exhaust the budget and free services suspend until the 1st. This
is the real cost of keeping it warm, and it is a per-workspace budget, not
per-service.

## What the cold start does to the demo

Nothing to the app: `useMemory` starts from `EMPTY_RECALL` and never gates content
on the fetch, so the dashboard renders complete and correct throughout. Every
number is local.

The danger was subtler. A swallowed recall failure looked *identical* to an empty
tenant, so a cold start made Stash greet a returning user as a stranger — the
deletion test, fired by accident, on the first visit of the day. Three things now
prevent that:

- `fetchRecall` returns `reachable` alongside the pack, so "unreachable" and
  "remembers nothing" are different states.
- It **retries through the boot** (1s, 2s, 4s, 8s, 15s, 30s — 60s total, covering
  the ~50s spin-up). A 4xx is not retried, since a rejected tenant will not fix
  itself. Verified against a mocked transport for all six paths.
- If it still fails, the UI says so plainly, and `App.tsx` does **not** bump
  `LAST_VISIT_KEY` — otherwise the since-last-visit delta would be consumed while
  showing nothing and lost for good once memory returned.

## 1. Prepare the snapshot store

A free HF account gets [100 GB of private storage](https://huggingface.co/docs/hub/storage-limits);
the snapshot is ~300 KB. You need only a **write-scoped token** from
<https://huggingface.co/settings/tokens> — no PRO, no Space.

```bash
hf repo create stash-memory --repo-type dataset --private
```

Or let the sidecar create it on its first snapshot (`create_repo(..., private=True,
exist_ok=True)`).

## 2. Create the service

Render reads `render.yaml` from the repo root. New → Blueprint, point it at the
repo, and it picks up the Docker service with `rootDir: sibyl-svc`.

Every secret is `sync: false`, so Render prompts for it on apply rather than
reading a committed value:

```
STASH_SVC_TOKEN         = <the same value Vercel has>
SIBYL_SNAPSHOT_REPO     = YOUR_USERNAME/stash-memory
SIBYL_SNAPSHOT_HF_TOKEN = hf_...            (write scope)
SIBYL_ACCOUNT_ID        = <from `sibyl init`>
SIBYL_SESSION_TOKEN     = <from `sibyl init`>
```

Leave `SIBYL_DB_PATH` unset. The Dockerfile pins it to `/data/memory.db` and
creates the directory owned by UID 1000, which works with or without a volume.

## 3. Point Vercel at it

```bash
vercel env add SIBYL_SVC_URL production   # https://stash-sibyl-svc.onrender.com
vercel env add SIBYL_SVC_TOKEN production
```

`SIBYL_SVC_HF_TOKEN` is **not** needed here — that only existed for a private HF
Space's own gate. Render does not gate the URL, so `X-Stash-Auth` is the only
credential in play.

## 4. Verify the deployment

```bash
curl -s https://stash-sibyl-svc.onrender.com/healthz

curl -s -H "X-Stash-Auth: $STASH_SVC_TOKEN" \
        -H "X-Stash-Tenant: 0x0000000000000000000000000000000000000001" \
        https://stash-sibyl-svc.onrender.com/persistence
```

`/persistence` must show `"enabled": true` and a `hf dataset …` store. If it says
`none (memory is not backed up)`, the snapshot secrets did not land and the
service is running with memory that dies on the next spin-down.

Then prove the round-trip on the real deployment: write a memory through the app,
**Manual Deploy → Clear build cache & deploy** (which wipes the filesystem), and
confirm `/recall-pack` still returns `remembers: true`.

Run the full local cycle against a throwaway dataset repo too — it exercises the
same `HubStore` code path:

```bash
cd sibyl-svc
export SIBYL_SNAPSHOT_REPO=YOUR_USERNAME/stash-memory-verify   # NOT the live repo
export SIBYL_SNAPSHOT_HF_TOKEN=hf_...
STASH_SVC_TOKEN=$(python3 -c "import secrets;print(secrets.token_urlsafe(24))") \
  .venv/bin/python verify_persistence.py
```

## 5. Keeping it warm — and the trap

Ping `/healthz` from an external scheduler (cron-job.org, UptimeRobot; both free,
5-minute minimum). Vercel Hobby crons are **daily only**, so they cannot do this.

`/healthz` is the right target: unauthenticated, returns no tenant data, and does
not touch the database.

Do the arithmetic before you enable it. Pinging every 10 minutes keeps the service
awake ~744 h/month against a 750 h workspace budget. That works only if this is
the workspace's **only** free service. If you also want a staging copy, do not keep
either warm — pre-warm manually instead.

**For judging, pre-warming by hand is the reliable move**: hit `/healthz` two
minutes before you send the link. Free, certain, ten seconds. The retry logic
covers you if you forget.

## Honest ceilings

- **The 20s→5s debounce shrinks but does not close** the hard-kill loss window.
  A SIGTERM (which Render sends on redeploy) flushes it; `SIGKILL` does not.
- **The snapshot is plaintext.** Sibyl does not encrypt at rest — verified: a
  written value is greppable in `memory.db`. So a private HF dataset now holds
  readable financial memory for every tenant. Same exposure as any host's disk,
  but one more copy in one more place. Encrypting before upload is a small change
  and adds a key you can lose the memory by losing.
- **One shared service token still means one trust boundary.** Any holder can read
  or write any tenant until SIWE lands. Unchanged by this move, still true.

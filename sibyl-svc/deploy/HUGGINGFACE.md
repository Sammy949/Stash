# Deploying the memory sidecar to a free Hugging Face Space

The free tier's disk is ephemeral: wiped on every restart, sleep-wake and rebuild.
`persist.py` makes that survivable by snapshotting to a **private dataset repo**,
so this needs no paid persistent-storage add-on. Read the "Durability on an
ephemeral host" section of `../README.md` for how the snapshot layer works.

What you are trading away by not paying the $5/mo:

- A **bounded loss window** on a hard kill, equal to `SIBYL_SNAPSHOT_DEBOUNCE_S`
  (default 20s). A graceful stop flushes it; a hard kill does not.
- A **cold start**. Free CPU-basic Spaces sleep after 48h of inactivity and the
  timer is not configurable on that hardware. The next visitor waits ~30–90s for
  the boot plus a ~300 KB snapshot download. Vercel's function timeout absorbs
  it, but a judge's first click hangs. Ping `/healthz` on a schedule to stay warm.

## 1. Two separate tokens

They are not the same credential and must not be reused for each other.

| Token | Scope | Lives in | Purpose |
|---|---|---|---|
| `SIBYL_SNAPSHOT_HF_TOKEN` | **write** | Space secret | the sidecar pushing snapshots to the dataset |
| `SIBYL_SVC_HF_TOKEN` | **read** | Vercel env | the proxy getting past a *private Space's* own gate |

Create both at <https://huggingface.co/settings/tokens>. Skip the second one
entirely if you make the Space public (the `STASH_SVC_TOKEN` still gates the app).

## 2. Create the private dataset

```bash
hf repo create stash-memory --repo-type dataset --private
```

Or let the sidecar create it on its first snapshot — `HubStore.save` calls
`create_repo(..., private=True, exist_ok=True)`.

## 3. Create the Space and push

`sibyl-svc/README.md` already carries the `sdk: docker` / `app_port: 7860` YAML
block Spaces needs, and the Dockerfile already creates the UID-1000 user Spaces
runs as, so the directory is pushable as-is.

```bash
hf repo create stash-sibyl-svc --repo-type space --sdk docker --private
cd sibyl-svc
git init && git add -A && git commit -m "chore: sibyl memory sidecar"
git remote add space https://huggingface.co/spaces/YOUR_USERNAME/stash-sibyl-svc
git push space main
```

`.env` is gitignored at the repo root — check it did not come along before you
push. Secrets go in the Space's Settings, never in the image.

## 4. Space secrets

Settings → Variables and secrets:

```
STASH_SVC_TOKEN           = <the same value Vercel has>
SIBYL_SNAPSHOT_REPO       = YOUR_USERNAME/stash-memory
SIBYL_SNAPSHOT_HF_TOKEN   = hf_...            (write scope)
SIBYL_SNAPSHOT_DEBOUNCE_S = 20
SIBYL_ACCOUNT_ID          = <from `sibyl init`>
SIBYL_SESSION_TOKEN       = <from `sibyl init`>
SIBYL_TIER                = stake
```

Leave `SIBYL_DB_PATH` unset: the Dockerfile pins it to `/data/memory.db`, which
the image creates and chowns so it works with or without a mounted volume.

## 5. Point Vercel at it

```bash
vercel env add SIBYL_SVC_URL production      # https://YOUR_USERNAME-stash-sibyl-svc.hf.space
vercel env add SIBYL_SVC_TOKEN production
vercel env add SIBYL_SVC_HF_TOKEN production # ONLY if the Space is private
```

`api/memory.ts` sends the service token as `X-Stash-Auth` and leaves
`Authorization` free for the Space's gate, so both can run at once.

## 6. Verify against the real deployment

```bash
curl -s https://YOUR_USERNAME-stash-sibyl-svc.hf.space/healthz

curl -s -H "X-Stash-Auth: $STASH_SVC_TOKEN" \
        -H "X-Stash-Tenant: 0x0000000000000000000000000000000000000001" \
        https://YOUR_USERNAME-stash-sibyl-svc.hf.space/persistence
```

`/persistence` must report `"enabled": true` and a `hf dataset …` store. If it
says `none (memory is not backed up)`, the snapshot secrets did not land and the
Space is running with memory that dies on the next restart.

Then run the full wipe-and-restore cycle locally against the **real** dataset,
which exercises the exact `HubStore` path the Space uses:

```bash
cd sibyl-svc
export SIBYL_SNAPSHOT_REPO=YOUR_USERNAME/stash-memory-verify   # NOT the live repo
export SIBYL_SNAPSHOT_HF_TOKEN=hf_...
STASH_SVC_TOKEN=$(python3 -c "import secrets;print(secrets.token_urlsafe(24))") \
  .venv/bin/python verify_persistence.py
```

Use a throwaway repo for the test: it writes and overwrites `memory.db` in
whatever repo you point it at.

Finally, prove it end to end on the Space itself — write a memory, hit
**Restart this Space** in Settings (which wipes the disk), and confirm
`/recall-pack` still returns `remembers: true`.

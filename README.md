# Stash

**A personal finance agent that already knows you.**

Built for students and young people whose money arrives in bursts — freelance
work, gigs, allowances, scholarships. Not a budgeting app: a companion that
remembers who you are between sessions and acts on it.

Live: **[heystash.app](https://heystash.app)**

---

## What makes it work: persistent memory

Stash's transcript is session-local. Reload the page and the conversation is
gone. What survives is everything that matters about *you* — stored in
[Sibyl Memory](https://sibyllabs.org) through a sidecar service, filed under a
tenant id.

That gap is the point. A fresh session opens with a blank chat and a Stash that
still knows your goal, your habits, and what moved since you were last here.

### What breaks when memory is deleted

Append `?nomemory` to the URL. `resolveTenant()` returns null, every read
resolves to `EMPTY_RECALL`, nothing is written. Then:

1. **The cold-start opener goes generic.** With memory, Stash's first line names
   your goal, your habit, and the delta since your last visit — rebuilt entirely
   from Sibyl, because the transcript is gone. Without it, you get a greeting
   that could be addressed to anyone.

2. **Proactive guidance dies completely.** `deriveObservation()`
   ([`src/lib/observations.ts`](src/lib/observations.ts)) matches a *committed*
   money event against remembered habits. With the habit *"Overspends the week
   after getting paid"* stored, logging income produces a specific intervention
   naming your own words back to you. With `EMPTY_RECALL`, the same event
   produces `null`. Silence.

3. **Stash stops being able to act on who you are** — which is the entire
   product claim.

**What honestly does not break:** the arithmetic. Balance is
`openingBalance + Σincome − Σexpenses`, computed in code, and maths does not need
recall. We are not going to pretend otherwise. The gate is not "nothing works
without memory" — it is "the thing this product claims to be does not work
without memory."

### Three-line walkthrough

**Persist** — facts and money events are written to Sibyl through the sidecar.
Entities via `writeMemory()` (consolidating in place when the subject already
exists), money events journalled to the COLD tier via `writeMoneyEvent()`, the
financial snapshot via `writeSnapshot()`. All in
[`src/lib/memory.ts`](src/lib/memory.ts) → [`api/memory.ts`](api/memory.ts) →
[`sibyl-svc/`](sibyl-svc/).

**Recall** — one round-trip. `fetchRecallPack()` calls `/recall-pack`, which
returns identity, goals, habits, preferences, opportunities, the financial
snapshot and recent events *together*, so the cold-start opener needs a single
fetch. A tenant with nothing stored returns `remembers: false` and Stash greets
plainly rather than showing a blank screen.

**Changes the decision by** — code, not the model, matches the event against
what is remembered. A remembered *risk* habit plus a committed income event
produces a deterministic intervention. The model never decides whether to
intervene, so it cannot be lost to a sampling roll or a rate limit.

### Memory primitives used

`recall` · `entities` · `temporal` · `consolidation` · `summarization`

Two we deliberately do **not** claim:

- **semantic search** — the sidecar exposes FTS5 keyword search
  (`GET /entities?q=`), not embeddings.
- **reflection** — designed, not built.

---

## Architecture

**Code owns the math.** Transactions are the source of truth and balance is
derived, never stored. The agent acts through tool calls
([`src/lib/agentTools.ts`](src/lib/agentTools.ts)); a pure reducer applies the
action and hands the model the computed result, including the exact new balance.
The system prompt forbids the model from inventing figures. Every invalid amount
(negative, zero, `NaN`, a string, an object) is rejected by reference, so a
rejected action cannot report success or trigger a memory write.

**Local-first.** `localStorage` is the working copy, written synchronously on
every change, so the UI never waits on a network call.

**The memory sidecar.** Sibyl Memory is a Python library over local SQLite, so it
runs as a small FastAPI service ([`sibyl-svc/`](sibyl-svc/)) that the browser
never talks to directly — every call goes through `/api/memory`, which injects
the service token server-side. Nothing secret reaches the bundle.
[`sibyl-svc/probe.py`](sibyl-svc/probe.py) is the end-to-end proof: 12 checks
over real HTTP including auth rejection, tenant isolation, consolidation
(same row id, evolved body) and the `remembers: false` cold-start path.

**Inference** is provider-agnostic over any OpenAI-compatible endpoint. The
deployed build runs Groq (`openai/gpt-oss-120b`, with `openai/gpt-oss-20b` as a
separate-rate-limit-bucket fallback), configured entirely by environment.

---

## Prior work

Stash existed before this hackathon, built for **Zero Cup 2026 (0G Labs)**. That
work is tagged `pre-sibyl-hackathon`; everything after it belongs to the Sibyl
build window.

The 0G integration has been **removed**, not just relabelled. The encrypted
ledger backup on 0G Storage, its serverless signing proxy, `ethers` and the 0G
SDK are all gone from the tree. It was removed rather than kept because it could
not deliver what it claimed: restoring a ledger required a root hash that itself
lived in `localStorage`, so it could only ever restore a browser that had not
actually lost anything.

What replaced it is not a like-for-like swap, and the distinction is worth being
precise about. The ledger is now local-first and local-only. Durability moved to
the memory layer, which holds who you are, what you are working toward and a
journal of money events — the things worth carrying between sessions. The
balance in front of you is reconstructable from your own entries; who you are
is not, which is why that is the part Sibyl keeps.

Removing it also dropped ~570KB from the bundle and five of the project's nine
dependency vulnerabilities.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
```

Copy `.env.example` to `.env` and fill in:

- `VITE_AI_BASE_URL` / `VITE_AI_API_KEY` / `VITE_AI_MODEL` — any
  OpenAI-compatible provider
- `SIBYL_SVC_URL` / `SIBYL_SVC_TOKEN` — the memory sidecar (server-side only,
  deliberately no `VITE_` prefix: a public service token would let anyone read
  any tenant's memory)
- `VITE_MEMORY_TENANT` — whose memory to read. An address-shaped id, because
  the sidecar validates that shape; nothing in the app connects a wallet

Running the sidecar and verifying it:

```bash
cd sibyl-svc
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export STASH_SVC_TOKEN=$(python3 -c "import secrets;print(secrets.token_urlsafe(24))")
.venv/bin/uvicorn app:app --port 8787

# in another shell, same token exported:
.venv/bin/python probe.py http://127.0.0.1:8787
```

---

## Honest limitations

- **There is no wallet, and no chain code.** Stash reads no balance, signs
  nothing and submits nothing on-chain. The tenant id is address-shaped because
  the sidecar validates that shape, not because an account is connected. A
  wallet-connect layer was built and then removed: with the 0G backup gone and
  no Base integration shipped, it was identity nobody could see and a
  dependency the product did not earn.
- **Tenant ownership is therefore not proven.** Whoever holds the service token
  can address any tenant. Signed sign-in (SIWE) is what would fix this, and it
  is not built.
- **The ledger is local-only.** Clear the browser and the numbers are gone. What
  survives is the memory, which is the part worth carrying.
- **Search is keyword, not semantic.** FTS5 over stored text.

---

Built by [Samuel Yahaya](https://github.com/Sammy949).

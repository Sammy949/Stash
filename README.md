<div align="center">

# Stash

### Know where you stand. See what's coming. Stay ahead.

**The financial memory companion for students with irregular income — it knows your real numbers, remembers what you're working toward, and acts on both.**

### 🔗 [Live demo → heystash.app](https://heystash.app)

Built for [Zero Cup 2026](https://0g.ai) · 0G Labs
by [Samuel Yahaya](https://twitter.com/I_am_SamY01) · [@Sammy949](https://github.com/Sammy949)

</div>

---

## The problem

Students don't have a budgeting problem. They have a **visibility problem**.

Money moves in unpredictable bursts — allowances drop late, clients pay in chunks, scholarships disburse on their own schedule. You can't budget like someone with a salary, because you don't have one. So most students just wing it.

**Stash exists so you don't have to wing it.**

It tracks where your money actually goes, keeps you ahead of scholarship deadlines, holds the things you're saving toward, and gives you an AI agent that knows your real numbers — your balance, your income streams, your next deadline — and talks to you about them specifically. It even remembers the durable things about you: your goals, your habits, what you're trying to become. And it remembers all of it across sessions, because your financial memory lives on **0G decentralized storage**: encrypted, decentralized, and yours.

---

## What makes Stash real (not a demo wrapper)

0G does genuine work here. It is the substrate, not decoration.

### 🔐 0G Storage — the core differentiator

Your financial ledger is stored as an **encrypted JSON file on the 0G decentralized storage network** as its durable backup — not a database we own. The app is local-first (`localStorage` is the working copy), and 0G is where your state is encrypted, finalized on-chain, and made portable.

- Ledger serialized and encrypted with the SDK's **native AES-256** encryption.
- The AES key is **derived from a wallet private key** — `sha256("stash-ledger-v1:" + privateKey)` → 32 bytes — so only that key decrypts the ledger.
- In production (`heystash.app`), sync runs through a same-origin **Vercel serverless proxy** (`/api/og-sync`) that holds the wallet key in **server env** (not the client bundle) and encrypts + uploads server-side. This also dodges the HTTPS→HTTP mixed-content block against the testnet's HTTP-only storage nodes. On `localhost`, the SDK runs directly in the browser.
- Uploaded via `MemData` to 0G Storage; the returned **root hash** is the only thing kept locally (`localStorage`).
- On the next session, the ledger is **downloaded and decrypted** (`downloadToBlob`) by that root hash — full state restored.
- Every sync surfaces the **real root hash** in a toast.
- `ethers` + the 0G SDK are **lazy-loaded** so the initial bundle stays small; the storage libraries load only on first sync.

**The result:** your financial life — income, spending, goals, scholarship status, and what Stash remembers about you — is AES-256 encrypted and finalized on a decentralized network, not a platform-owned database.

> **Honest scope.** This demo signs with a single testnet/throwaway wallet, so the encryption is real but not yet per-user. A production multi-user build derives a per-user key and moves all signing behind the proxy — the architecture is already shaped for it.

### 🤖 0G Compute — wired and ready

The Stash AI agent is built for the **0G Compute Router** (`router-api.0g.ai`, model `glm-5`), via an OpenAI-compatible interface.

- **Provider-agnostic by design** — the endpoint, key, and model are environment variables. Point them at the 0G Router to run inference natively on 0G; no code change.
- The **live ledger is injected into the system prompt on every call**, so the agent knows your exact balance, deadlines, and income streams and answers specifically — never with generic advice.
- The 0G Compute Router is billed against a **mainnet** 0G balance. For this testnet build, the live demo runs inference on **Groq** as an OpenAI-compatible provider (`openai/gpt-oss-120b`, with `llama-3.3-70b-versatile` as a separate-bucket fallback; swappable via env) — verified working (HTTP 200, sub-second responses, open CORS). The 0G Compute integration is complete and activates the instant a funded Router balance is supplied.
- **Resilient by default** — rate-limit backoff (Retry-After-aware), a same-key fallback model for when a provider's per-minute cap is hit, robust tool-call parsing, and a deterministic fallback reply mean a completed action is never lost to a flaky provider mid-demo.

---

## Core features

### 💸 Expense & income tracking
Just talk to it. Type *"Spent ₦2,000 on transport"* or *"Got ₦12k from a client"* → the agent emits a **structured tool call** (`log_expense` / `log_income`), the ledger reducer applies it, the Vault card's progress ring and numbers **animate live**, and the state syncs to 0G Storage with a real root-hash toast. No brittle regex — all natural language goes through the agent, and the **code owns the math** so the dashboard and the agent's words never disagree. Ask *"analyze my spending"* and you get a **code-computed** category breakdown card — exact percentages, never model arithmetic.

### 🎯 Living savings goals
Set a target by talking — *"I want to save ₦200k for a laptop"* (`add_goal`) — and earmark money toward it whenever you set funds aside (`contribute_to_goal`). Goals track progress **independently of your spendable balance** (an earmark model, never a transaction), so saving toward something never distorts what you can actually spend. When income lands, Stash offers to set some aside; before a big purchase, it tells you honestly what the buy costs you in goal progress.

### 🧠 Financial memory
Beyond the numbers, Stash remembers the durable things about you — goals, habits, preferences, identity, and opportunities (`remember` / `update_memory` / `forget_memory`). That memory is injected into every prompt, so advice arrives with context instead of starting from zero. It's **felt in the replies**, not shown as a database screen.

### 🔔 Proactive guidance
Stash speaks up unprompted — a scholarship deadline closing this week, a goal trade-off, a *"since you were last here…"* recap on return. Each is computed in **code** (deterministic, never a hallucinated number) and surfaced one at a time, never as spam.

### ✏️ Edit & replay
Edit a past message and Stash rewinds to the exact state it held before that turn and re-runs from there. The money is **restored from a snapshot, never reconstructed by the model** — correcting *"₦5,000"* to *"₦500"* updates everything downstream, deterministically.

### 🎓 Scholarship Radar
A **dynamic urgency system** — red / amber / green are derived from the actual deadline dates, not hardcoded. Under 7 days is critical, under 30 is approaching. You add and manage scholarships through the agent (`add_scholarship` / `remove_scholarship`).

### ⚡ Hustle Ledger
Income streams with status tracking — *received, active, pending, building* — and a live-calculated total of active monthly income. Managed conversationally (`add_income_stream` / `remove_income_stream`).

### 🤖 The agent that acts (and owns its math)
A conversational agent with full ledger context — your balance, deadlines, income streams, goals, and what it remembers about you, all injected into every call. It **acts via tool calls**, distinguishes money that actually *moved* from money that's only *owed or planned* (so it never logs a phantom expense — it offers to turn an obligation into a goal instead), and **never computes a balance itself**: code hands it the exact numbers as facts it must use verbatim. Direct, warm, built for the student hustle — short sentences, no fluff, real talk.

---

## Tech Stack

- React 18 + TypeScript + Vite 6
- 0G Storage (AES-256 encrypted ledger persistence)
- 0G Compute Router (OpenAI-compatible inference)
- Groq `openai/gpt-oss-120b` (demo inference provider; `llama-3.3-70b-versatile` fallback, swappable via env)
- Tailwind CSS v4, ethers.js
- Vercel Serverless Functions (the `/api/og-sync` 0G proxy)

---

## Getting started

### Prerequisites
- Node.js 18+
- A funded [0G Galileo testnet](https://faucet.0g.ai) wallet (throwaway — see the security note)
- A [Groq API key](https://console.groq.com) (free) **or** a [0G Compute Router key](https://pc.0g.ai)

### Installation

```bash
git clone https://github.com/Sammy949/Stash
cd Stash
npm install
```

### Environment setup

```bash
cp .env.example .env
```

Fill in `.env` for **local dev** (on `localhost` the browser runs the SDK directly):

```bash
# AI inference — Groq (OpenAI-compatible) for the testnet demo
VITE_AI_BASE_URL=https://api.groq.com/openai/v1
VITE_AI_API_KEY=gsk_your_groq_key
VITE_AI_MODEL=openai/gpt-oss-120b
VITE_AI_FALLBACK_MODEL=llama-3.3-70b-versatile   # separate rate-limit bucket; used when the primary hits its TPM cap

# 0G Storage — funded Galileo testnet wallet (throwaway only)
VITE_OG_PRIVATE_KEY=0x_your_testnet_wallet_key
VITE_OG_RPC_URL=https://evmrpc-testnet.0g.ai
VITE_OG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
```

In **production** (Vercel), set the 0G Storage keys **server-side** — no `VITE_` prefix, so they never reach the client bundle — and sync flows through the `/api/og-sync` proxy:

```bash
OG_PRIVATE_KEY=0x_your_testnet_wallet_key
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
```

To run inference **natively on 0G Compute** instead of Groq, swap the three `VITE_AI_*` values:

```bash
VITE_AI_BASE_URL=https://router-api.0g.ai/v1
VITE_AI_API_KEY=sk_your_router_key   # requires a funded mainnet Router balance
VITE_AI_MODEL=glm-5
```

> **Security note.** In the deployed build, 0G signing already runs **server-side** in the `/api/og-sync` proxy (`OG_PRIVATE_KEY` is never in the client bundle); the AI key and the local-dev `VITE_OG_PRIVATE_KEY` are still client-side. Use a **throwaway, testnet-only wallet with minimal funds** either way — a full production build moves inference behind the proxy too and derives per-user keys. `.env` is gitignored.

### Run & build

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
```

---

## The live demo — judge flows

### Flow 1 — Expense logging + 0G sync
Type **"Spent ₦2,000 on transport"**. The Vault ring animates, the numbers update live, and a toast appears carrying the **real 0G Storage root hash**.

### Flow 2 — Persistence (the real 0G proof)
**Hard-refresh** the page (`Ctrl/Cmd + Shift + R`). You'll see *"Restoring from 0G Storage…"*, and your logged expense is still there.
This is **not** localStorage — the state is reconstructed from decentralized storage by its root hash.

### Flow 3 — Agent with live context
Click **"🎓 Scholarship deadlines"**. The agent responds with *your* specific deadlines, the exact days remaining, and concrete next steps — because the live ledger is in its prompt.

### Flow 4 — Edit a message, watch reality re-derive
Hover a message you sent, edit the amount, and save. Stash rewinds to the state it held before that turn and re-runs — the balance and everything downstream update from the **restored snapshot, not a model guess**. The clearest proof of *intelligent agent, deterministic money*.

---

## Architecture notes

### Data flow
A single `Ledger` object — transactions, goals, scholarships, hustles, and soft memories — flows through everything:

1. **Empty on first load** — no seed data; your ledger grows from your own entries (onboarding sets name, currency, and opening balance).
2. **Local-first** — `localStorage` is the canonical working copy, written synchronously on every change so the UI never waits on the network.
3. **Updated** on every agent tool call via a pure reducer (the code computes the new balance; the model never invents math).
4. **Re-encrypted and backed up** to 0G Storage on sync — through a Vercel serverless proxy — and the new root hash is persisted.
5. **Hydrated** from 0G on boot if a root hash exists, and **injected** into the agent's system prompt on every call.

### Why 0G Storage over a database
A central database is owned by the platform; storage on 0G is designed to be owned by the user. A student's financial life is deeply personal data — Stash puts it on a decentralized, encrypted, user-controllable substrate instead of a database we own. (Per-user key custody is the production step; the demo signs with one testnet wallet — see the honest-scope note above.)

### Bundle strategy
`ethers` + the 0G SDK total ~500 KB. They're dynamically imported inside the sync functions, so the initial dashboard chunk is ~150 KB and the 0G libraries load only on first sync. Fast first paint, snappy feel.

### Sync durability
Uploads run with finality required — each sync blocks until 0G confirms the data is durably stored, so the root hash in the toast points at genuinely finalized, verifiable data. The UI updates optimistically in the meantime, so the wait is never blocking.

---

## Project

- **120+ atomic commits**, conventional-commits style (`type(scope): description`).
- Full history: [github.com/Sammy949/Stash/commits/main](https://github.com/Sammy949/Stash/commits/main)

---

## Built for

A final-year student running a design agency, teaching a coding bootcamp, pursuing international scholarships, and building something real — all at the same time.

Not a Silicon Valley demo. Built for someone actually living this.

<div align="center">

---

**Built for Zero Cup 2026 · 0G Labs**
by Samuel Yahaya · [@I_am_SamY01](https://twitter.com/I_am_SamY01) · [github.com/Sammy949/Stash](https://github.com/Sammy949/Stash)

</div>

<div align="center">

# Stash

### Know where you stand. See what's coming. Stay ahead.

**The personal finance agent that knows your financial life — and helps you stay ahead of it.**

### 🔗 [Live demo → heystash.vercel.app](https://heystash.vercel.app)

Built for [Zero Cup 2026](https://0g.ai) · 0G Labs
by [Samuel Yahaya](https://twitter.com/I_am_SamY01) · [@Sammy949](https://github.com/Sammy949)

</div>

---

## The problem

Students don't have a budgeting problem. They have a **visibility problem**.

Money moves in unpredictable bursts — allowances drop late, clients pay in chunks, scholarships disburse on their own schedule. You can't budget like someone with a salary, because you don't have one. So most students just wing it.

**Stash exists so you don't have to wing it.**

It tracks where your money actually goes, keeps you ahead of scholarship deadlines, and gives you an AI agent that knows your real numbers — your balance, your income streams, your next deadline — and talks to you about them specifically. And it remembers all of it across sessions, because your financial memory lives on **0G decentralized storage**: encrypted, decentralized, and yours.

---

## What makes Stash real (not a demo wrapper)

0G does genuine work here. It is the substrate, not decoration.

### 🔐 0G Storage — the core differentiator

Your financial ledger is stored as an **encrypted JSON file on the 0G decentralized storage network** — not a database we own, not browser localStorage.

- Ledger serialized and encrypted with the SDK's **native AES-256** encryption.
- The AES key is **derived deterministically from your wallet** — `sha256("stash-ledger-v1:" + privateKey)` → 32 bytes. The same wallet always, and only, decrypts its own ledger. The key is never stored or transmitted.
- Uploaded via `MemData` to 0G Storage; the returned **root hash** is the only thing kept locally (`localStorage`).
- On the next session, the ledger is **downloaded and decrypted** (`downloadToBlob`) by that root hash — full state restored.
- Every sync surfaces the **real root hash** in a toast.
- `ethers` + the 0G SDK are **lazy-loaded** so the initial bundle stays ~150 KB; the storage libraries load only on first sync.

**The result:** your financial life — income, spending, scholarship status — is encrypted, decentralized, and sovereign. Nobody else can read it.

### 🤖 0G Compute — wired and ready

The Stash AI agent is built for the **0G Compute Router** (`router-api.0g.ai`, model `glm-5`), via an OpenAI-compatible interface.

- **Provider-agnostic by design** — the endpoint, key, and model are environment variables. Point them at the 0G Router to run inference natively on 0G; no code change.
- The **live ledger is injected into the system prompt on every call**, so the agent knows your exact balance, deadlines, and income streams and answers specifically — never with generic advice.
- The 0G Compute Router is billed against a **mainnet** 0G balance. For this testnet build, the live demo runs inference on **Groq** (`llama-3.3-70b-versatile`) as an OpenAI-compatible provider — verified working (HTTP 200, sub-second responses, open CORS). The 0G Compute integration is complete and activates the instant a funded Router balance is supplied.

---

## Core features

### 💸 Budget tracking
Natural-language expense logging. Type *"Spent ₦2,000 on transport"* → Stash parses the amount and category → the Vault card's progress ring and numbers **animate live** → the ledger syncs to 0G Storage with a real root-hash toast.

### 🎓 Scholarship Radar
A **dynamic urgency system** — red / amber / green are derived from the actual deadline dates, not hardcoded. Under 7 days is critical, under 30 is approaching. Preloaded with MEXT, Mastercard Foundation, ALU Rwanda, Türkiye Burslari, and KGSP.

### ⚡ Hustle Ledger
Income streams with status tracking — *received, active, pending, building* — and a live-calculated total of active monthly income.

### 🧠 Stash AI agent
A conversational agent with full ledger context. It knows your balance, deadlines, and income streams, and responds specifically. Direct, warm, and built for the Nigerian student hustle — short sentences, no fluff, real talk.

---

## Tech Stack

- React 18 + TypeScript + Vite 6
- 0G Storage (AES-256 encrypted ledger persistence)
- 0G Compute Router (OpenAI-compatible inference)
- Groq llama-3.3-70b (demo inference provider)
- Tailwind CSS v4, ethers.js

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

Fill in `.env`:

```bash
# AI inference — Groq (OpenAI-compatible) for the testnet demo
VITE_AI_BASE_URL=https://api.groq.com/openai/v1
VITE_AI_API_KEY=gsk_your_groq_key
VITE_AI_MODEL=llama-3.3-70b-versatile

# 0G Storage — funded Galileo testnet wallet (throwaway only)
VITE_OG_PRIVATE_KEY=0x_your_testnet_wallet_key
VITE_OG_RPC_URL=https://evmrpc-testnet.0g.ai
VITE_OG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
```

To run inference **natively on 0G Compute** instead of Groq, swap the three `VITE_AI_*` values:

```bash
VITE_AI_BASE_URL=https://router-api.0g.ai/v1
VITE_AI_API_KEY=sk_your_router_key   # requires a funded mainnet Router balance
VITE_AI_MODEL=glm-5
```

> **Security note.** `VITE_OG_PRIVATE_KEY` and the AI key are bundled into the client for this testnet build — use a **throwaway, testnet-only wallet with minimal funds**. A production deployment would move signing and inference behind a serverless proxy. `.env` is gitignored.

### Run & build

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
```

---

## The live demo — three judge flows

### Flow 1 — Expense logging + 0G sync
Type **"Spent ₦2,000 on transport"**. The Vault ring animates, the numbers update live, and a toast appears carrying the **real 0G Storage root hash**.

### Flow 2 — Persistence (the real 0G proof)
**Hard-refresh** the page (`Ctrl/Cmd + Shift + R`). You'll see *"Restoring from 0G Storage…"*, and your logged expense is still there.
This is **not** localStorage — the state is reconstructed from decentralized storage by its root hash.

### Flow 3 — Agent with live context
Click **"🎓 Scholarship deadlines"**. The agent responds with *your* specific deadlines, the exact days remaining, and concrete next steps — because the live ledger is in its prompt.

---

## Architecture notes

### Data flow
A single `Ledger` object flows through everything:

1. **Seeded** with realistic student data on first load.
2. **Hydrated** from 0G Storage on boot if a root hash exists in `localStorage`.
3. **Updated** on every expense log (instant, local — the UI never waits on the network).
4. **Re-encrypted and uploaded** to 0G on sync; the new root hash is persisted.
5. **Injected** into the agent's system prompt on every call.

### Why 0G Storage over a database
A central database is owned by the platform. 0G Storage is owned by the user. A student's financial life is deeply personal data — Stash puts it where it belongs: with the student, encrypted and sovereign.

### Bundle strategy
`ethers` + the 0G SDK total ~500 KB. They're dynamically imported inside the sync functions, so the initial dashboard chunk is ~150 KB and the 0G libraries load only on first sync. Fast first paint, snappy feel.

### Sync durability
Uploads run with finality required — each sync blocks until 0G confirms the data is durably stored, so the root hash in the toast points at genuinely finalized, verifiable data. The UI updates optimistically in the meantime, so the wait is never blocking.

---

## Project

- **~30 atomic commits**, conventional-commits style (`type(scope): description`).
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

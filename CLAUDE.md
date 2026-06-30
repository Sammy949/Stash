# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Stash is

A personal-finance **agent/companion** for students and young people with irregular income (freelance, gigs, allowances, scholarships). Built for the **Zero Cup 2026** hackathon (0G Labs) — currently in the knockout round (Top 32, AI Companions category). The pitch: an AI companion that knows your real numbers and *acts* on them, with **encrypted, sovereign financial memory on 0G decentralized storage**. Live at `heystash.app`. Builder: Samuel Yahaya (@Sammy949).

## Commands

```bash
npm run dev      # Vite dev server → http://localhost:5173
npm run build    # tsc -b && vite build  (typecheck gate, then bundle)
npm run preview  # serve the production build
npm run lint     # eslint .
```

There is **no test runner** — verification is manual (browser) + live API probes against the inference provider and 0G testnet.

## Stack

React 18 + TypeScript (strict) + Vite 6 · Tailwind v4 (dark only; deep-navy + single blue accent `#3B82F6`) · `@0gfoundation/0g-storage-ts-sdk@1.2.10` · `ethers@6.13.1` (pinned) · OpenAI-compatible inference · `sonner` for toasts · Vercel (with a serverless function in `api/`).

## Architecture

**Data model is the spine.** A single `Ledger` object flows through everything. Transactions (income/expense) are the source of truth; **balance is derived, never stored** (`openingBalance + Σincome − Σexpenses`). The app is **empty-first** — no seed data; state grows from the user's own entries (`EMPTY_LEDGER`, not a seed).

**Persistence is local-first.** `localStorage` is the canonical working copy (written synchronously on every change); **0G Storage is the durable encrypted backup**. The ledger is AES-256 encrypted (SDK-native, key derived from the wallet), uploaded via `MemData`, and the root hash is persisted. On reload it restores by decrypting. 0G sync is **proxied through the Vercel serverless function** (`api/og-sync.ts`) to dodge the HTTPS→HTTP mixed-content block against testnet nodes. Wrapped in retry-with-backoff.

**The agent acts via tool calls** — this is the headline feature. There is no NL regex parser (it was deleted); all natural language goes through the model, which is *forced* to emit tool calls on money events. `ogCompute.runAgentTurn` runs the tool loop: model call → apply action via a pure reducer → feed the computed result (including the exact new balance) back → grounded reply. **Code owns all the math; the prompt forbids the model from inventing balance figures.** An idempotency guard rejects duplicate money-event logs.

### Key files
- `src/lib/ledger.ts` — `Ledger` model, pure reducers (`addTransaction`/`removeTransaction`/`setMonthlyBudget`), derived helpers, `EMPTY_LEDGER`, schema migrations (current: v3).
- `src/lib/agentTools.ts` — `AGENT_TOOLS` OpenAI tool schemas (`log_expense`, `log_income`, `set_monthly_budget`, `delete_last_transaction`, `add_scholarship`, `remove_scholarship`, `add_income_stream`, `remove_income_stream`) + pure `applyAction` + `normalizeCategory` (buckets free-form categories) + idempotency.
- `src/lib/ogStorage.ts` — encrypt/upload/download + retry; local-first logic.
- `src/lib/ogCompute.ts` — `runAgentTurn` tool loop + the "wise-friend" system prompt.
- `src/lib/currency.ts` — supported currencies + `formatMoney` (NGN/USD/GHS/KES/ZAR/RWF/GBP/EUR).
- `src/hooks/useLedger.ts` — ledger state, hydrate, sync, `applyLedger`, `initProfile`.
- `src/hooks/useAgent.ts` — transcript + `send` → `runAgentTurn`.
- `src/App.tsx` — onboarding gate + Split-Shift shell (dashboard-first; floating command bar expands the agent panel, numbers stay visible).
- `api/og-sync.ts` — Vercel serverless 0G sync proxy.
- `src/components/{Dashboard,Agent,Onboarding,UI}/*` — view layer.

## 0G integrations — honest framing (state this to judges)

- **0G Storage — REAL, verified live.** The genuine on-chain feature: encrypted ledger finalized on 0G (~45–60s), restores on reload.
- **0G Compute — code Router-ready, demo on Groq.** The 0G Router needs a *mainnet* balance (real money; no testnet router), so the demo runs **Groq** (`openai/gpt-oss-120b`, with `llama-3.3-70b-versatile` as a rate-limit fallback) via swappable env (`VITE_AI_BASE_URL`/`_API_KEY`/`_MODEL`/`_FALLBACK_MODEL`). Provider-agnostic — point the three env vars at `router-api.0g.ai/v1` + `glm-5` to run natively on 0G, zero code change.

## Conventions & gotchas

- **Conventional commits** (`type(scope): description`), atomic. `main` is the working branch.
- **Keys are in the client bundle** (`VITE_OG_PRIVATE_KEY`, `VITE_AI_API_KEY`) — testnet/throwaway only. A production build must move signing + inference behind the serverless proxy. Rotate the Groq key after judging. `.env` is gitignored.
- **Never let the model compute balances** — when adding agent behavior, hand it pre-computed facts and keep the math in `ledger.ts` reducers. This is a load-bearing invariant.
- Unofficial files (handoff notes, ideas, screenshots) go in the gitignored `notes/` dir, not the repo root.

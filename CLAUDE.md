# CLAUDE.md

This file provides guidance for working in the Stash repository.

## What Stash is

Stash is a personal-finance **agent/companion** for students and young people
with irregular income: freelance work, gigs, allowances and scholarships. Its
product claim is not "a smarter chatbot" or "a budgeting app". Stash remembers
who the user is between sessions and acts on that context. The ledger remains
the deterministic calculator; Sibyl is what makes the companion personal.

Stash was originally built for the Zero Cup 2026 hackathon (0G Labs). That is
prior-work context only. The current build uses Sibyl Memory for durable,
cross-session memory and does not make 0G the platform or primary UI story.

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # tsc -b && vite build
npm run preview  # serve the production build
npm run lint     # eslint .
```

There is no test runner. Verification is manual browser testing plus the live
HTTP probes in `sibyl-svc/` and provider checks where needed.

## Stack

React 19 + TypeScript (strict) + Vite 6 · Tailwind v4 · Base UI/shadcn
primitives · Geist · Phosphor icons · Motion · OpenAI-compatible inference ·
`sonner`. The app is deployed as a Vite frontend with Vercel serverless
routes in `api/`; the Sibyl sidecar is FastAPI/Python with SQLite persistence.

## Architecture

**Code owns the math.** `Ledger` is the local working model. Transactions are
the source of truth and balance is derived, never stored:
`openingBalance + Σincome − Σexpenses`. The app is empty-first: it grows from
the user's entries and does not ship seed financial data.

**Local-first ledger.** `localStorage` is the synchronous working copy, so the
dashboard remains instant and usable offline. It is not the durable memory
layer. Durable cross-session context lives in Sibyl: identity, goals, habits,
preferences, opportunities, a derived financial snapshot, and journalled money
events.

**Sibyl is load-bearing.** The browser calls `api/memory.ts`, which injects the
server-side service token before forwarding to `sibyl-svc/`. The sidecar owns
tenant-scoped memory operations and SQLite persistence. `/recall-pack` hydrates
the cold-start opener and agent context in one request. With `?nomemory`, reads
resolve to `EMPTY_RECALL`, the opener becomes generic and proactive remembered-
habit guidance disappears. The balance must still work: arithmetic does not
depend on memory.

**The agent acts via tool calls.** Natural language goes through the model and
the tool loop in `src/lib/agent.ts`. Money events are forced through tools;
pure reducers apply them; code returns exact facts for the final response.
Memory operations are written through to Sibyl after a committed action, and
money events are journalled only after the ledger update succeeds. The model
must never calculate or invent balances, goal progress, runway or percentages.

**Inference is provider-agnostic.** The browser calls the same-origin
`/api/agent` route. Provider credentials and model selection stay server-side;
the route forwards to any OpenAI-compatible provider and can retry with a
fallback model on rate limits.

### Key files

- `src/lib/ledger.ts` — ledger model, pure reducers, derived financial helpers and migrations.
- `src/lib/agent.ts` — agent system prompt, tool loop, grounded finalization and provider client.
- `src/lib/agentTools.ts` — tool schemas, pure action application, validation and idempotency.
- `src/lib/memory.ts` — typed browser client, tenant resolution, recall and memory operations.
- `src/lib/memoryJournal.ts` — post-commit Sibyl event journal and financial snapshot writes.
- `src/lib/observations.ts` — deterministic proactive guidance from remembered context.
- `src/lib/currency.ts` — supported currencies and formatting helpers.
- `src/hooks/useLedger.ts` — local ledger state, hydration and committed updates.
- `src/hooks/useAgent.ts` — ephemeral transcript, cold-start recall and `send`.
- `src/App.tsx` — onboarding gate and dashboard/agent shell.
- `api/agent.ts` — server-side OpenAI-compatible inference proxy.
- `api/memory.ts` — server-side Sibyl proxy and service-token boundary.
- `sibyl-svc/` — FastAPI sidecar, gateway, persistence and HTTP probes.
- `src/components/{Dashboard,Agent,Onboarding,UI}/*` — view layer.

## Memory and security invariants

- **Never let the model compute balances.** Hand it code-computed facts and use
	those facts verbatim in narration.
- **Memory must not break money.** Sidecar failures are background/degraded
	persistence failures; they must not roll back a successful local ledger turn
	or report a failed money action as successful.
- **Tenant isolation is mandatory.** Every sidecar request must resolve and
	validate a tenant. Do not expose the sidecar directly to the browser.
- **The current sidecar token flow is transitional.** It uses a service token
	plus tenant header. SIWE/wallet-backed tenant authentication is the planned
	hardening before broad multi-user deployment; do not describe the current
	flow as user-authenticated.
- **Secrets stay server-side.** Keep provider and Sibyl credentials in `.env`
	or deployment secrets. Never add them to Vite `VITE_*` variables, source,
	notes, screenshots or committed docs.
- `?nomemory` is an intentional deletion-test path. Preserve it when changing
	recall or proactive behavior.

## Conventions

- Use conventional commits (`type(scope): description`) and keep changes atomic.
- `main` is the working branch. Do not commit unless explicitly requested.
- Put unofficial handoff notes, ideas and screenshots in the gitignored `notes/`
	directory, not the repository root.
- When documenting the product, lead with the financial companion and Sibyl
	memory. Mention Zero Cup/0G only as prior work unless a specific historical
	comparison is needed.

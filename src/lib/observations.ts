import type { Ledger } from "@/types";
import { getGoals } from "@/lib/ledger";
import { EMPTY_RECALL, memoryLine, type RecallPack } from "@/lib/memory";
import { formatMoney } from "@/lib/currency";

/**
 * Proactive observations — Stash noticing, unprompted.
 *
 * This is the bridge from "remembers facts" to "knows me": code (never the
 * LLM) spots a meaningful collision between a money event and what Stash
 * remembers, and surfaces ONE short line. Deterministic on purpose — the
 * observation references the user's own memory verbatim, no numbers invented.
 *
 * The memory half comes from Sibyl, so with the memory layer gone this returns
 * null and the proactivity disappears.
 *
 * Scope is deliberately narrow: income arriving while a savings goal exists,
 * but ONLY when that goal is a soft MEMORY (no structured Goal). When a
 * structured Goal exists, the agent's own reply already weaves the "set some
 * aside?" nudge from code-computed GOAL CONTEXT facts (goalContext.ts) — so
 * firing this bubble too would double-mention. One observation at a time;
 * returns null when nothing is worth saying.
 */
export function deriveObservation(
  prev: Ledger,
  next: Ledger,
  recall: RecallPack = EMPTY_RECALL,
): string | null {
  // What changed this turn — only brand-new transactions, matched by id.
  const prevIds = new Set(prev.transactions.map((t) => t.id));
  const income = next.transactions.find(
    (t) => !prevIds.has(t.id) && t.type === "income",
  );
  if (!income) return null;

  // Structured goals own the in-reply nudge — don't duplicate it here.
  if (getGoals(next).length > 0) return null;

  // ...otherwise fall back to a remembered goal, if Sibyl is holding one.
  const goal = (recall.goals ?? [])[0];
  if (!goal) return null;

  const amount = formatMoney(income.amount, next.currency);
  return `By the way — you just brought in ${amount}, and you told me: “${memoryLine(goal)}”. Want to set some aside for that before it gets spent?`;
}

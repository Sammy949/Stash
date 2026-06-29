import type { Ledger } from "@/types";
import { getMemories } from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";

/**
 * Proactive observations — Stash noticing, unprompted.
 *
 * This is the bridge from "remembers facts" to "knows me": code (never the
 * LLM) spots a meaningful collision between a money event and what Stash
 * remembers, and surfaces ONE short line. Deterministic on purpose — the
 * observation references the user's own memory verbatim, no numbers invented.
 *
 * Scope is deliberately narrow for now: income arriving while a savings goal
 * exists. One observation at a time; returns null when nothing is worth
 * saying, so it never interrupts for the sake of it.
 */
export function deriveObservation(prev: Ledger, next: Ledger): string | null {
  // What changed this turn — only brand-new transactions, matched by id.
  const prevIds = new Set(prev.transactions.map((t) => t.id));
  const income = next.transactions.find(
    (t) => !prevIds.has(t.id) && t.type === "income",
  );
  if (!income) return null;

  // ...and only if Stash is holding a savings goal to protect.
  const goal = getMemories(next).find((m) => m.kind === "goal");
  if (!goal) return null;

  const amount = formatMoney(income.amount, next.currency);
  return `By the way — you just brought in ${amount}, and you told me: “${goal.content}”. Want to set some aside for that before it gets spent?`;
}

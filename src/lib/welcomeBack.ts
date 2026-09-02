import type { Ledger } from "@/types";
import { daysUntil, getGoals, goalRemaining } from "@/lib/ledger";
import { EMPTY_RECALL, type RecallPack } from "@/lib/memory";
import {
  movedSince,
  rememberedGoal,
  rememberedHabit,
  rememberedName,
} from "@/lib/opener";
import { formatMoney } from "@/lib/currency";

/**
 * The welcome-back card — Stash greeting you on return, before you ask anything.
 *
 * This is the cold-start recall surface: the FIRST thing Stash says in a brand
 * new session, assembled from what it remembers in Sibyl plus the money maths
 * from the local ledger. DETERMINISTIC and code-owned — every number is computed
 * here, never by the model, so it is instant and cannot hallucinate.
 *
 * Memory is the reason it exists. With the memory layer deleted `remembers` is
 * false, this returns null, and the dashboard renders bare with no greeting at
 * all. That absence is the visible half of the deletion test.
 */

export type FactTone = "accent" | "warn" | "default";

export interface WelcomeBackFact {
  text: string;
  tone: FactTone;
}

export interface WelcomeBack {
  greeting: string;
  facts: WelcomeBackFact[];
}

export function deriveWelcomeBack(
  ledger: Ledger,
  lastVisitAt: string | null,
  recall: RecallPack = EMPTY_RECALL,
  now: Date = new Date(),
): WelcomeBack | null {
  // No memory, no greeting. Not a degraded greeting — none.
  if (!recall.remembers) return null;

  const cur = ledger.currency;
  const facts: WelcomeBackFact[] = [];

  // The goal, leading with real figures when a structured target exists and
  // falling back to the remembered phrasing when it's still just an intention.
  const goal = getGoals(ledger).find((g) => goalRemaining(g) > 0);
  const soft = rememberedGoal(recall);
  if (goal) {
    facts.push({
      text: `${formatMoney(goal.savedAmount, cur)} into ${goal.name}, ${formatMoney(goalRemaining(goal), cur)} to go`,
      tone: "accent",
    });
  } else if (soft) {
    facts.push({ text: `You're saving toward “${soft}”`, tone: "default" });
  }

  // The habit Stash remembers. This is the line that reads as "it knows me"
  // rather than "it stored my data", so it sits high in the list.
  const habit = rememberedHabit(recall);
  if (habit) facts.push({ text: `You flagged: “${habit}”`, tone: "default" });

  // Money that actually moved while they were away (createdAt-based, exact).
  const since = lastVisitAt ? Date.parse(lastVisitAt) : NaN;
  if (!Number.isNaN(since)) {
    const { income, expenses } = movedSince(ledger, since);
    if (income > 0) {
      facts.push({ text: `+${formatMoney(income, cur)} came in`, tone: "accent" });
    }
    if (expenses > 0) {
      facts.push({ text: `${formatMoney(expenses, cur)} went out`, tone: "default" });
    }
  }

  // Nearest upcoming scholarship deadline.
  const next = ledger.scholarships
    .filter((s) => s.deadline)
    .map((s) => ({ s, d: daysUntil(s.deadline!, now) }))
    .filter((x) => x.d >= 0)
    .sort((a, b) => a.d - b.d)[0];
  if (next) {
    const when =
      next.d === 0
        ? "closes today"
        : next.d === 1
          ? "closes tomorrow"
          : `closes in ${next.d} days`;
    facts.push({
      text: `${next.s.name} ${when}`,
      tone: next.d < 7 ? "warn" : "default",
    });
  }

  if (facts.length === 0) return null; // nothing worth interrupting for

  const name = rememberedName(ledger, recall);
  return {
    greeting: name ? `Welcome back, ${name}.` : "Welcome back.",
    facts,
  };
}

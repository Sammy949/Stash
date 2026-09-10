import type { Ledger } from "@/types";
import { daysUntil, getGoals, goalRemaining } from "@/lib/ledger";
import { DEADLINE_DAYS } from "@/lib/attention";
import { EMPTY_RECALL, type RecallPack } from "@/lib/memory";
import {
  movedSince,
  rememberedGoal,
  rememberedHabit,
  rememberedRisk,
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
  const risk = rememberedRisk(recall);
  const habit = rememberedHabit(recall);
  if (risk) {
    facts.push({ text: `You flagged: “${risk}”`, tone: "default" });
  } else if (habit) {
    facts.push({ text: `You mentioned: “${habit}”`, tone: "default" });
  }

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

  // Nearest upcoming scholarship deadline — but only once it is far enough out
  // that the attention slot is not already carrying it.
  //
  // The two surfaces sit on the same screen, so without this split a deadline
  // three days away appeared as a bullet here AND as the attention row directly
  // below, which is the same sentence twice. The division is by urgency and it
  // is a real one: the slot owns anything inside the red band (it is a standing
  // row that persists until dealt with), and this greeting keeps the wider
  // horizon — the deadline that is coming but not yet pressing, which the slot
  // deliberately stays silent about.
  const next = ledger.scholarships
    .filter((s) => s.deadline)
    .map((s) => ({ s, d: daysUntil(s.deadline!, now) }))
    .filter((x) => x.d >= DEADLINE_DAYS)
    .sort((a, b) => a.d - b.d)[0];
  if (next) {
    // Always plural days and always the neutral tone, both of which follow from
    // the filter above: nothing under DEADLINE_DAYS reaches here, so there is no
    // "closes today" case left to handle and nothing to raise the alarm for.
    // Amber is warnings-only in this palette, and a deadline more than a week
    // out is not a warning — it is the horizon.
    facts.push({
      text: `${next.s.name} closes in ${next.d} days`,
      tone: "default",
    });
  }

  if (facts.length === 0) return null; // nothing worth interrupting for

  const name = rememberedName(ledger, recall);
  return {
    greeting: name ? `Welcome back, ${name}.` : "Welcome back.",
    facts,
  };
}

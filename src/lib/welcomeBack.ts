import type { Ledger } from "@/types";
import { daysUntil, getMemories } from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";

/**
 * Welcome-back summary — "Since you were last here…".
 *
 * The demo's opening "it remembers me" moment. Like `deriveObservation`, this
 * is DETERMINISTIC and code-owned: every number is computed here (never by the
 * model), and any memory is quoted verbatim. No LLM call, so it's instant and
 * can't hallucinate — it just reflects the real ledger + what Stash remembers.
 *
 * Returns null when there's nothing worth saying (first-ever session, or no
 * meaningful change since the last visit) so it never greets for its own sake.
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
  now: Date = new Date(),
): WelcomeBack | null {
  if (!lastVisitAt) return null; // first-ever session — nothing to recap
  const since = Date.parse(lastVisitAt);
  if (Number.isNaN(since)) return null;

  const facts: WelcomeBackFact[] = [];

  // Money that moved since the last visit (deterministic, createdAt-based).
  const fresh = ledger.transactions.filter((t) => Date.parse(t.createdAt) > since);
  const income = fresh
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expenses = fresh
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  if (income > 0) {
    facts.push({
      text: `+${formatMoney(income, ledger.currency)} came in`,
      tone: "accent",
    });
  }
  if (expenses > 0) {
    facts.push({
      text: `${formatMoney(expenses, ledger.currency)} went out`,
      tone: "default",
    });
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

  // A goal Stash is holding for the user — quoted verbatim from memory.
  const goal = getMemories(ledger).find((m) => m.kind === "goal");
  if (goal) {
    facts.push({ text: `You're saving toward “${goal.content}”`, tone: "default" });
  }

  if (facts.length === 0) return null; // nothing worth interrupting for

  const name = ledger.owner.trim();
  return {
    greeting: name ? `Welcome back, ${name}.` : "Welcome back.",
    facts,
  };
}

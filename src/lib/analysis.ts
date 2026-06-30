import type { Ledger, SpendingBreakdown } from "@/types";

/**
 * Spending analysis — code-owned, deterministic (like decisionContext /
 * deriveObservation). The model never produces these figures; it answers in
 * prose and this breakdown is attached as a card, so the numbers are always
 * exact. Returns null when there isn't enough to say something honest.
 */

const WINDOW_DAYS = 30;
const MIN_EXPENSES = 2;

/** Human label for a category key ("data" → "Data", "airtime" → "Airtime"). */
function titleCase(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function analyzeSpending(
  ledger: Ledger,
  now: Date = new Date(),
): SpendingBreakdown | null {
  const since = now.getTime() - WINDOW_DAYS * 86_400_000;
  const expenses = ledger.transactions.filter(
    (t) => t.type === "expense" && Date.parse(t.createdAt) >= since,
  );
  if (expenses.length < MIN_EXPENSES) return null;

  const total = expenses.reduce((s, t) => s + t.amount, 0);
  if (total <= 0) return null;

  const byCategory = new Map<string, number>();
  for (const t of expenses) {
    const key = t.category ?? "other";
    byCategory.set(key, (byCategory.get(key) ?? 0) + t.amount);
  }

  const rows = [...byCategory.entries()]
    .map(([key, amount]) => ({
      label: titleCase(key),
      amount,
      pct: Math.round((amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    currency: ledger.currency,
    windowDays: WINDOW_DAYS,
    total,
    rows,
    topLabel: rows[0].label,
    topShare: rows[0].pct,
  };
}

/** Whether a user message is asking for a spending breakdown (chip or NL). */
export function isSpendingQuery(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /analyze .*spend/.test(t) ||
    /spending breakdown|break ?down .*spend/.test(t) ||
    /where('?s| is| does) .*(money|cash) go/.test(t) ||
    /what .*(do i|am i) spend(ing)? .*(most|on)/.test(t)
  );
}

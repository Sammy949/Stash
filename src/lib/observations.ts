import type { ExpenseCategory, Ledger, Transaction } from "@/types";
import { getGoals, goalRemaining } from "@/lib/ledger";
import { focusGoal } from "@/lib/goalContext";
import { EMPTY_RECALL, memoryLine, type RecallPack } from "@/lib/memory";
import { formatMoney } from "@/lib/currency";

/**
 * Proactive observations — Stash noticing, unprompted.
 *
 * This is the bridge from "remembers facts" to "knows me", and it is CODE, not
 * the model. A turn's money event is matched against what Sibyl is holding, and
 * when the two collide Stash says one short, specific thing.
 *
 * Why it is not left to the LLM: it was, and it did not work. With the habit
 * "Overspends the week after getting paid" sitting in the system prompt, the
 * model was asked "I just got paid 200,000, what should I watch out for?" and
 * gave materially the same answer as a run with memory switched off entirely.
 * Recall reaching the prompt is not the same as recall reaching the decision.
 * So the intervention is derived here, deterministically, and cannot be lost to
 * a sampling roll or a rate limit.
 *
 * Everything below depends on the Sibyl recall pack. With the memory layer gone
 * (or `?nomemory`) `recall` is EMPTY_RECALL, every rule returns null, and the
 * proactivity disappears — which is exactly what the deletion test should show.
 */

/**
 * The cue that a remembered habit describes a RISK rather than a neutral fact.
 * "I get paid on the 25th" is a fact and Stash should stay quiet; "I overspend
 * after payday" is a flag the user raised about themselves, and acting on it is
 * the whole point. Required by every habit rule below.
 */
const RISK_CUE =
  /overspend|over-spend|splurge|spree|impulse|blow (?:it|through|my|the)|burn through|waste|wasteful|go(?:es)? overboard|too much|can'?t (?:help|stop)|lose track|bad (?:at|with)|struggle/i;

/** The cue that a habit is about the moment money ARRIVES. */
const PAYDAY_CUE =
  /pay ?day|paid|paycheck|pay ?check|salary|wages?|allowance|stipend|when (?:the )?money (?:comes|lands|arrives)|after (?:a|my|each) (?:payment|deposit)/i;

/**
 * Category cues, using the same vocabulary the logging tools normalise to
 * (`normalizeCategory` in agentTools), plus the synonyms a person actually
 * says. "other" is deliberately absent: it is the fallback bucket, so matching
 * on it would fire against almost anything.
 */
const CATEGORY_CUES: Record<Exclude<ExpenseCategory, "other">, RegExp> = {
  transport: /transport|transit|fare|uber|bolt|taxi|fuel|petrol|commut/i,
  data: /\bdata\b|internet|wifi|wi-fi|broadband|subscription/i,
  food: /food|eat(?:ing)? out|takeaway|takeout|restaurant|snack|groceries|dining|delivery/i,
  printing: /print(?:ing|out)?|photocop/i,
  airtime: /airtime|recharge|top ?up|\bcalls?\b/i,
  rent: /rent|housing|accommodation|landlord/i,
};

/**
 * What kind of money event a remembered habit is about, or null when it is not
 * actionable. This is the one piece of interpretation in the chain, and it is a
 * pure function of the stored text: same memory, same answer, every time.
 */
type TrackedCategory = Exclude<ExpenseCategory, "other">;

export type HabitTrigger =
  | { on: "income" }
  | { on: "expense"; category: TrackedCategory };

export function habitTrigger(content: string): HabitTrigger | null {
  if (!RISK_CUE.test(content)) return null;
  if (PAYDAY_CUE.test(content)) return { on: "income" };
  for (const category of Object.keys(CATEGORY_CUES) as TrackedCategory[]) {
    if (CATEGORY_CUES[category].test(content)) {
      return { on: "expense", category };
    }
  }
  return null;
}

/** Transactions that exist in `next` but not in `prev`, matched by id. */
function newTransactions(prev: Ledger, next: Ledger): Transaction[] {
  const seen = new Set(prev.transactions.map((t) => t.id));
  return next.transactions.filter((t) => !seen.has(t.id));
}

/** 30-day spend in one category. Code owns every figure Stash states. */
function recentCategorySpend(
  ledger: Ledger,
  category: ExpenseCategory,
  now: Date,
): number {
  const since = now.getTime() - 30 * 86_400_000;
  return ledger.transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        t.category === category &&
        Date.parse(t.createdAt) >= since,
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * The main event. Returns ONE line, or null when there is nothing worth saying.
 *
 * Rules are ordered by how much they depend on memory: a habit the user flagged
 * about themselves beats a goal they mentioned, because it is the more specific
 * thing Stash knows.
 */
export function deriveObservation(
  prev: Ledger,
  next: Ledger,
  recall: RecallPack = EMPTY_RECALL,
  now: Date = new Date(),
): string | null {
  const fresh = newTransactions(prev, next);
  if (fresh.length === 0) return null;

  const income = fresh.find((t) => t.type === "income");
  const expenses = fresh.filter((t) => t.type === "expense");
  const money = (n: number) => formatMoney(n, next.currency);

  // ── Rule 1: a habit the user flagged, meeting the event that triggers it.
  //
  // This is the rule that makes memory load-bearing. The line names the amount
  // (from the event), quotes the habit verbatim (only obtainable from Sibyl),
  // and offers a concrete next move sized from real figures. It is impossible
  // to produce from the transaction alone.
  for (const entity of recall.habits ?? []) {
    const habit = memoryLine(entity);
    const trigger = habitTrigger(habit);
    if (!trigger) continue;

    if (trigger.on === "income" && income) {
      const protect = protectTarget(next, recall, money);
      return (
        `${money(income.amount)} just landed, and this is the window you flagged: ` +
        `“${habit}”. ${protect}`
      );
    }

    if (trigger.on === "expense") {
      const hit = expenses.find((t) => t.category === trigger.category);
      if (!hit) continue;
      const spent = recentCategorySpend(next, trigger.category, now);
      const total =
        spent > hit.amount
          ? ` That puts ${trigger.category} at ${money(spent)} over the last 30 days.`
          : "";
      return (
        `${money(hit.amount)} on ${trigger.category}, and you told me: ` +
        `“${habit}”.${total}`
      );
    }
  }

  // ── Rule 2: a remembered goal, when income lands.
  //
  // Scoped, not blanket. This used to bail whenever ANY structured Goal existed,
  // which silently disabled the whole observation layer for every user who set a
  // goal during onboarding. The real conflict is narrower: when a structured
  // goal exists the agent's own reply already carries the "set some aside?"
  // nudge from GOAL CONTEXT (goalContext.incomeGoalFacts), so repeating it here
  // would double-mention. That is a reason to suppress THIS rule, not Rule 1,
  // which says something different.
  if (!income) return null;
  if (getGoals(next).length > 0) return null;
  const goal = (recall.goals ?? [])[0];
  if (!goal) return null;

  return (
    `By the way: you just brought in ${money(income.amount)}, and you told me: ` +
    `“${memoryLine(goal)}”. Want to set some aside for that before it gets spent?`
  );
}

/**
 * The concrete "protect it now" half of a payday intervention.
 *
 * Prefers a structured goal, because that comes with a real remaining figure to
 * quote. Falls back to a goal Stash only REMEMBERS, then to a plain question.
 * Never invents a fraction of the income to set aside: the amounts here are the
 * user's own, and suggesting "a quarter" would be Stash inventing a policy.
 */
function protectTarget(
  ledger: Ledger,
  recall: RecallPack,
  money: (n: number) => string,
): string {
  const goal = focusGoal(ledger);
  if (goal) {
    return `“${goal.name}” still needs ${money(goalRemaining(goal))}. Want to move some across before the week starts?`;
  }
  const remembered = (recall.goals ?? [])[0];
  if (remembered) {
    return `You're saving toward “${memoryLine(remembered)}”. Want to set some aside before the week starts?`;
  }
  return "Want to decide now what you're protecting, before the week starts?";
}

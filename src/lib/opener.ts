import type { Ledger } from "@/types";
import { balance, decisionContext, getGoals, goalRemaining } from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";
import { memoryLine, type RecallPack } from "@/lib/memory";

/**
 * The cold-start opener — what Stash says before you say anything.
 *
 * Every line here is CODE-COMPUTED from the ledger plus the Sibyl recall pack.
 * No model call, on purpose: this is the one moment that has to be instant, can
 * never invent a number, and cannot fail on a rate limit while the camera is
 * running. Memory supplies what Stash knows; the ledger supplies the maths.
 *
 * With memory gone `remembers` is false and this collapses to a bare greeting
 * that names nothing — which is exactly what the deletion test should look like.
 */

/**
 * The name to greet by. Prefers the identity Stash REMEMBERS, falling back to
 * the local profile only when memory is present: with memory deleted the
 * greeting stays anonymous rather than borrowing the name from localStorage.
 */
export function rememberedName(ledger: Ledger, recall: RecallPack): string {
  if (!recall.remembers) return "";
  const body = recall.identity?.body ?? {};
  const remembered = typeof body.name === "string" ? body.name.trim() : "";
  return remembered || ledger.owner.trim();
}

/** How many things Stash currently remembers, across every category. */
export function rememberedCount(recall: RecallPack): number {
  return (
    (recall.identities?.length ?? 0) +
    (recall.goals?.length ?? 0) +
    (recall.habits?.length ?? 0) +
    (recall.preferences?.length ?? 0) +
    (recall.opportunities?.length ?? 0)
  );
}

/** The remembered goal (a Sibyl `goal` entity), quoted verbatim. */
export function rememberedGoal(recall: RecallPack): string | null {
  const goal = (recall.goals ?? [])[0];
  return goal ? memoryLine(goal) : null;
}

/** The remembered habit, quoted verbatim. */
export function rememberedHabit(recall: RecallPack): string | null {
  const habit = (recall.habits ?? [])[0];
  return habit ? memoryLine(habit) : null;
}

/** Money that moved since `since`, from the local ledger (code owns the maths). */
export function movedSince(
  ledger: Ledger,
  since: number,
): { income: number; expenses: number } {
  const fresh = ledger.transactions.filter(
    (t) => Date.parse(t.createdAt) > since,
  );
  const sum = (type: "income" | "expense") =>
    fresh.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  return { income: sum("income"), expenses: sum("expense") };
}

/**
 * The greeting when Stash remembers nothing. Also the pre-hydration seed, so the
 * transcript is readable from the first frame and no content waits on a fetch.
 */
export const PLAIN_OPENER =
  "Hi, I'm Stash. Tell me what's moving with your money and I'll keep track of it.";

/**
 * The greeting as prose, for the transcript. Assembled from whichever parts
 * exist, so a thin memory produces a short line rather than a template with
 * gaps in it.
 */
export function deterministicOpener(
  ledger: Ledger,
  recall: RecallPack,
  lastVisitAt?: string | null,
): string {
  if (!recall.remembers) return PLAIN_OPENER;

  const cur = ledger.currency;
  const name = rememberedName(ledger, recall);
  const parts: string[] = [name ? `Welcome back, ${name}.` : "Welcome back."];

  // Structured goal first (it has real figures), else the remembered one.
  const goal = getGoals(ledger).find((g) => goalRemaining(g) > 0);
  const softGoal = rememberedGoal(recall);
  if (goal) {
    parts.push(
      `You're ${formatMoney(goal.savedAmount, cur)} into ${goal.name}, ${formatMoney(goalRemaining(goal), cur)} to go.`,
    );
  } else if (softGoal) {
    parts.push(`You told me you're saving toward “${softGoal}”.`);
  }

  // What actually moved while they were away.
  const since = lastVisitAt ? Date.parse(lastVisitAt) : NaN;
  if (!Number.isNaN(since)) {
    const { income, expenses } = movedSince(ledger, since);
    if (income > 0) {
      parts.push(`${formatMoney(income, cur)} came in since we last spoke.`);
    } else if (expenses > 0) {
      parts.push(`${formatMoney(expenses, cur)} went out since we last spoke.`);
    }
  }

  const habit = rememberedHabit(recall);
  if (habit) parts.push(`You've flagged before: “${habit}”.`);

  const ctx = decisionContext(ledger);
  if (ctx.inTheRed) {
    parts.push(`You're below zero right now, at ${formatMoney(balance(ledger), cur)}.`);
  }

  parts.push("What do you want to stay ahead of?");
  return parts.join(" ");
}

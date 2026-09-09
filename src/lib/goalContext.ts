import type { Currency, Goal, Ledger } from "@/types";
import {
  daysUntil,
  getGoals,
  goalEvents,
  goalProgressPct,
  goalRemaining,
} from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";

/**
 * Goal context — turning stored goals into LIVING context.
 *
 * Code (never the model) computes every goal-relevant number — how much is
 * left, the saving pace a target date demands, what a purchase costs in
 * "weeks of progress" — and hands them to the agent as FACTS it must use
 * verbatim. This is the same division of labour as the rest of Stash: the
 * accountant does the math, the friend does the talking.
 *
 * Honesty rule baked in: schedule/pace talk is GATED on a target date. A goal
 * with no date gets money-terms context only — never an invented week count.
 */

/** Incomplete goals only (savedAmount still short of target). */
function openGoals(goals: Goal[]): Goal[] {
  return goals.filter((g) => g.targetAmount > 0 && g.savedAmount < g.targetAmount);
}

/**
 * The single goal Stash should care about most right now. Prefers the most
 * time-pressing dated goal (soonest future deadline); with no dated goals,
 * the one nearest completion (smallest amount remaining) — the most motivating
 * to mention. Returns null when there's no open goal worth surfacing.
 */
export function focusGoal(ledger: Ledger, now: Date = new Date()): Goal | null {
  const open = openGoals(getGoals(ledger));
  if (open.length === 0) return null;

  const dated = open
    .filter((g) => g.targetDate && daysUntil(g.targetDate, now) >= 0)
    .sort((a, b) => daysUntil(a.targetDate!, now) - daysUntil(b.targetDate!, now));
  if (dated.length > 0) return dated[0];

  return [...open].sort((a, b) => goalRemaining(a) - goalRemaining(b))[0];
}

/**
 * Pace a dated goal demands to land on time. Null when the goal has no target
 * date or the date has passed — the gate that keeps schedule talk honest.
 */
export interface PaceFacts {
  daysLeft: number;
  remaining: number;
  /** Saving rate needed to hit the target by its date. */
  perWeek: number;
  perMonth: number;
}

export function paceFacts(goal: Goal, now: Date = new Date()): PaceFacts | null {
  if (!goal.targetDate) return null;
  const daysLeft = daysUntil(goal.targetDate, now);
  if (daysLeft <= 0) return null;
  const remaining = goalRemaining(goal);
  if (remaining <= 0) return null;
  return {
    daysLeft,
    remaining,
    perWeek: remaining / (daysLeft / 7),
    perMonth: remaining / (daysLeft / 30),
  };
}

/**
 * The pace they are ACTUALLY keeping, measured from the goal's own history —
 * and where that lands them.
 *
 * `paceFacts` above answers "what would it take?" from the target date.
 * This answers "what are you doing?" from what actually happened, which is only
 * answerable now that contributions are recorded rather than summed away into
 * one number. The two are deliberately separate: one is a demand, this is an
 * observation, and mixing them would let a wish read as a measurement.
 *
 * The honesty gates, all of them load-bearing:
 * - Two real contributions minimum. A single deposit (or a lone carried-over
 *   row from the migration) is a point, not a trend, and extrapolating from it
 *   would invent a rate out of nothing.
 * - The window runs from the FIRST contribution to NOW, and only counts what
 *   arrived after that first one. Ending at "now" rather than at the last
 *   deposit is what makes a stalled goal's projection correctly slip away
 *   instead of staying flattering.
 * - A one-week floor on the window, so two deposits in two days cannot
 *   extrapolate into a fantasy monthly rate.
 * - No projected date past ten years out; beyond that the number is honest but
 *   the date is theatre.
 */
export interface ObservedPace {
  /** Money per 30 days, measured over the window. Always > 0. */
  perMonth: number;
  /** Days of history the rate is measured over (at least 7). */
  spanDays: number;
  /** How many real contributions the goal has (the sample size). */
  basedOn: number;
  /** ISO date this pace lands on the target, or null when it's too far out. */
  projectedDate: string | null;
}

export function observedPace(goal: Goal, now: Date = new Date()): ObservedPace | null {
  const remaining = goalRemaining(goal);
  if (remaining <= 0) return null;

  const contributions = goalEvents(goal)
    .filter((e) => e.kind === "contribution" && (e.amount ?? 0) > 0)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (contributions.length < 2) return null;

  const first = Date.parse(contributions[0].at);
  if (!Number.isFinite(first)) return null;
  const spanDays = Math.max(7, (now.getTime() - first) / 86_400_000);

  // Everything AFTER the opening deposit: those are the increments the window
  // actually observed. Including the opener would credit the window with money
  // that arrived at its very start, before any time had passed.
  const gained = contributions
    .slice(1)
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);
  if (gained <= 0) return null;

  const perDay = gained / spanDays;
  const daysToGo = remaining / perDay;
  const projected =
    daysToGo <= 3650
      ? new Date(now.getTime() + daysToGo * 86_400_000).toISOString()
      : null;

  return {
    perMonth: perDay * 30,
    spanDays,
    basedOn: contributions.length,
    projectedDate: projected,
  };
}

/**
 * How many weeks of required saving a purchase of `amount` represents, at the
 * pace the goal's date demands. Null when there's no dated pace to measure
 * against. Floored at 1 week for any positive, sub-week spend so a real
 * trade-off never rounds away to "0 weeks".
 */
export function purchaseSetbackWeeks(
  goal: Goal,
  amount: number,
  now: Date = new Date(),
): number | null {
  const pace = paceFacts(goal, now);
  if (!pace || pace.perWeek <= 0 || amount <= 0) return null;
  const weeks = amount / pace.perWeek;
  return Math.max(1, Math.round(weeks));
}

/**
 * Pull the headline money amount out of a free-text purchase musing
 * ("should I buy a 50k jacket", "can I afford a £200 dinner", "airpods for
 * 250"). Expands k/m shorthand, then takes the LARGEST token — purchases are
 * the big number in the sentence, dodging stray small ones ("2 airpods").
 * Returns 0 when nothing money-shaped is present.
 */
export function extractPrimaryAmount(text: string): number {
  const t = text.toLowerCase();
  const tokens = t.match(/\d[\d,.]*\s*(?:k|m|thousand|million)?/g);
  if (!tokens) return 0;
  let max = 0;
  for (const tok of tokens) {
    let mult = 1;
    if (/\bmillion\b|\dm\b|\d\s*m\b/.test(tok)) mult = 1_000_000;
    else if (/\bthousand\b|\dk\b|\d\s*k\b/.test(tok)) mult = 1_000;
    const num = Number(tok.replace(/[^\d.]/g, ""));
    if (Number.isFinite(num)) max = Math.max(max, num * mult);
  }
  return max;
}

/**
 * FACTS line offered to the agent after income lands while an open goal
 * exists — the "set some aside?" moment. Numbers are code-owned; the prompt
 * tells the agent to offer (not auto-move) a contribution. Null when there's
 * no open goal to protect.
 */
export function incomeGoalFacts(
  ledger: Ledger,
  currency: Currency,
  now: Date = new Date(),
): string | null {
  const g = focusGoal(ledger, now);
  if (!g) return null;
  const money = (n: number) => formatMoney(n, currency);
  const remaining = goalRemaining(g);
  const pct = Math.round(goalProgressPct(g));
  const close = pct >= 80 ? " They're SO close, worth a nudge." : "";
  const due =
    g.targetDate && daysUntil(g.targetDate, now) >= 0
      ? `, due ${g.targetDate} (${daysUntil(g.targetDate, now)} days)`
      : "";
  return `GOAL CONTEXT (use verbatim, don't recompute): they're saving for "${g.name}": ${money(g.savedAmount)} of ${money(g.targetAmount)} (${money(remaining)} to go, ${pct}%${due}).${close} Offer to set part of this income aside toward it (suggest contribute_to_goal). Do NOT move money yourself.`;
}

/**
 * FACTS note for a pre-spend musing while an open goal exists — the "this
 * would set you back" moment. Schedule talk (week count) appears ONLY for a
 * dated goal; otherwise it's a money-terms trade-off. Null when there's no
 * open goal or no amount to weigh.
 */
export function purchaseImpactFacts(
  ledger: Ledger,
  amount: number,
  currency: Currency,
  now: Date = new Date(),
): string | null {
  if (amount <= 0) return null;
  const g = focusGoal(ledger, now);
  if (!g) return null;
  const money = (n: number) => formatMoney(n, currency);
  const remaining = goalRemaining(g);
  const weeks = purchaseSetbackWeeks(g, amount, now);
  const head = `PURCHASE-IMPACT FACTS (use verbatim, don't recompute): they're weighing spending ${money(amount)}. Their focus goal "${g.name}" has ${money(remaining)} to go`;
  if (weeks !== null) {
    const pace = paceFacts(g, now)!;
    return `${head} and is due ${g.targetDate}, needing ${money(pace.perWeek)}/week. That spend is about ${weeks} week${weeks === 1 ? "" : "s"} of "${g.name}" progress, so weigh it honestly. Only state the week figure if you mention the trade-off.`;
  }
  return `${head}. No target date set, so frame the trade-off in MONEY ("${money(amount)} that won't go toward ${g.name}"), NOT weeks.`;
}

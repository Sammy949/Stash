import type { Ledger } from "@/types";
import {
  daysUntil,
  decisionContext,
  getGoals,
  goalProgressPct,
  goalRemaining,
  isGoalComplete,
} from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";

/**
 * The attention slot — the ONE thing that needs the user right now, or nothing.
 *
 * This exists because the dashboard used to give every tracker a permanent slot,
 * which meant a deadline 200 days out and a deadline 3 days out were rendered at
 * exactly the same weight. That is flat UI over spiky data: the card could not
 * express urgency, so nothing on the page could.
 *
 * The fix is to stop treating variable-priority data as furniture. Scholarships
 * and income streams now live behind the tracking strip, and what surfaces on
 * the dashboard is only the thing that has actually gone urgent. Absent by
 * default is the entire point — a slot that always renders "nothing upcoming"
 * is a card again, and teaches the eye to skip it.
 *
 * Like `deriveObservation` and `deriveWelcomeBack`, this is CODE, not the model.
 * Every figure it states comes from the ledger reducers, so it is instant,
 * cannot hallucinate a number, and cannot be lost to a rate limit mid-demo.
 *
 * Unlike those two it does NOT depend on the Sibyl recall pack: a deadline is a
 * ledger fact, the same class of thing as the balance, so it survives
 * `?nomemory`. The deletion test is about Stash forgetting the *person*, not
 * about it losing the arithmetic.
 */

/** What the line is about. The component maps this to the mark and the ink. */
export type AttentionKind = "deadline" | "runway" | "goal";

export interface Attention {
  kind: AttentionKind;
  /** The whole thing, in one sentence. */
  text: string;
  /** Label for the control that hands this to the agent. */
  actionLabel: string;
  /** The sentence primed into the composer when they act on it. */
  prompt: string;
}

/**
 * Matches `deriveUrgency`'s "red" band, so the slot and the radar agree on what
 * "urgent" means. Exported because `deriveWelcomeBack` divides its deadline fact
 * against this exact line — the slot takes anything inside it, the greeting
 * keeps everything beyond — and two copies of the number would drift into either
 * a gap (a deadline neither surface mentions) or an overlap (both saying it).
 */
export const DEADLINE_DAYS = 7;
/** Under two weeks of money left is worth interrupting for. */
const RUNWAY_DAYS = 14;
/** A goal this close is worth finishing rather than forgetting. */
const NEARLY_DONE_PCT = 90;

/**
 * Rules are ordered by what it costs to miss them, not by how interesting they
 * are. A scholarship deadline is irreversible — miss it and the money is gone
 * for a year — so it outranks a runway you can still correct and a goal that is
 * merely close. Exactly one fires, or none do.
 */
export function deriveAttention(
  ledger: Ledger,
  now: Date = new Date(),
): Attention | null {
  const money = (n: number) => formatMoney(n, ledger.currency);

  // ── Rule 1: a deadline inside the red band.
  const next = ledger.scholarships
    .filter((s) => s.deadline)
    .map((s) => ({ s, d: daysUntil(s.deadline!, now) }))
    .filter((x) => x.d >= 0 && x.d < DEADLINE_DAYS)
    .sort((a, b) => a.d - b.d)[0];

  if (next) {
    const when =
      next.d === 0
        ? "closes today"
        : next.d === 1
          ? "closes tomorrow"
          : `closes in ${next.d} days`;
    return {
      kind: "deadline",
      text: `${next.s.name} ${when}.`,
      actionLabel: "Ask about it",
      prompt: `${next.s.name} ${when}. What do I still need to do for it?`,
    };
  }

  // ── Rule 2: the money runs out sooner than the month does.
  //
  // `runwayDays` is deliberately conservative — it is null until there are three
  // recent expenses to set a pace, and null while overdrawn. Being in the red is
  // NOT surfaced here on purpose: the instrument already states it as a negative
  // headline figure in destructive ink with a zero-crossing line drawn through
  // the trace, and the opener says it in prose. A fourth voice saying the same
  // thing is nagging, not noticing.
  const ctx = decisionContext(ledger, now);
  if (ctx.runwayDays !== null && ctx.runwayDays < RUNWAY_DAYS) {
    const days = ctx.runwayDays;
    return {
      kind: "runway",
      text:
        days === 0
          ? `At your recent pace, ${money(ctx.balance)} is about a day of spending.`
          : `At your recent pace, ${money(ctx.balance)} lasts about ${days} ${days === 1 ? "day" : "days"}.`,
      actionLabel: "Work it out",
      prompt: "My balance is running low. Help me work out what to cut.",
    };
  }

  // ── Rule 3: a goal within reach.
  //
  // The one positive rule, and it is last because nothing breaks if it is never
  // seen. Closest-to-done wins, so the slot names the one actually worth
  // finishing rather than whichever was added first.
  const nearly = getGoals(ledger)
    .filter((g) => !isGoalComplete(g) && goalProgressPct(g) >= NEARLY_DONE_PCT)
    .sort((a, b) => goalRemaining(a) - goalRemaining(b))[0];

  if (nearly) {
    return {
      kind: "goal",
      text: `${nearly.name} is ${money(goalRemaining(nearly))} from done.`,
      actionLabel: "Finish it",
      prompt: `I want to finish off ${nearly.name}.`,
    };
  }

  return null;
}

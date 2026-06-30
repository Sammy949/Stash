import type { Currency, Goal } from "@/types";
import { daysUntil, goalProgressPct, goalRemaining } from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";

/**
 * Inline goal card — visible proof of a savings goal's state, rendered inside
 * an agent message bubble at the moments a goal is touched (created, earmarked)
 * or reviewed. Read-only and DISPLAY-ONLY: every figure comes from the pure
 * helpers in ledger.ts (goalProgressPct / goalRemaining / daysUntil) — this
 * component never does its own money math. Balance is never implicated; a goal
 * is an earmark, not a transaction.
 */

/** A light, name-based glyph. Cosmetic only — falls back to a generic target. */
function goalEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/laptop|macbook|computer|pc\b/.test(n)) return "💻";
  if (/phone|iphone|android|pixel/.test(n)) return "📱";
  if (/tuition|school|semester|universit|college|degree|course/.test(n))
    return "🎓";
  if (/car|vehicle|bike|motor/.test(n)) return "🚗";
  if (/rent|house|home|apartment|flat/.test(n)) return "🏠";
  if (/trip|travel|flight|holiday|vacation|abroad/.test(n)) return "✈️";
  if (/camera|lens/.test(n)) return "📷";
  if (/emergency|safety|rainy/.test(n)) return "🛟";
  return "🎯";
}

/** Bottom-right deadline label. Empty when the goal carries no target date. */
function deadlineLabel(goal: Goal): { text: string; warn: boolean } | null {
  if (!goal.targetDate) return null;
  const days = daysUntil(goal.targetDate);
  if (days < 0) return { text: "overdue", warn: true };
  if (days === 0) return { text: "due today", warn: true };
  return { text: `${days} day${days === 1 ? "" : "s"} left`, warn: false };
}

export function GoalCard({ goal, currency }: { goal: Goal; currency: Currency }) {
  const pct = Math.round(goalProgressPct(goal));
  const reached = goalRemaining(goal) === 0 && goal.targetAmount > 0;
  const deadline = deadlineLabel(goal);

  return (
    <div className="w-72 rounded-xl border border-line border-l-2 border-l-emerald bg-card/80 p-3.5">
      {/* Name + percentage */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <span aria-hidden>{goalEmoji(goal.name)}</span>
          <span className="truncate">{goal.name}</span>
        </span>
        <span className="font-data shrink-0 text-sm font-semibold text-emerald">
          {pct}%
        </span>
      </div>

      {/* Progress bar — blue fill, capped at 100% by goalProgressPct */}
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-emerald"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>

      {/* Amount saved / target + deadline */}
      <div className="mt-2 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-data text-muted">
          {formatMoney(goal.savedAmount, currency)}{" "}
          <span className="text-muted/60">/</span>{" "}
          {formatMoney(goal.targetAmount, currency)}
        </span>
        {reached ? (
          <span className="text-emerald">reached</span>
        ) : deadline ? (
          <span className={deadline.warn ? "text-amber" : "text-muted"}>
            {deadline.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}

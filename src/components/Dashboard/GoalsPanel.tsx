import type { Currency, Goal } from "@/types";
import { goalProgressPct, goalRemaining, isGoalComplete } from "@/lib/ledger";
import { formatMoneyCompact, formatMoney } from "@/lib/currency";
import { TargetIcon, CheckIcon } from "@/components/UI/icons";

const VISIBLE = 4;

/**
 * Goals panel — savings targets with earmarked progress. Each goal shows
 * saved/target (compact) and a progress bar. Progress is the earmark counter,
 * never the spendable balance (see `Goal` in types). Mirrors the structure of
 * ScholarshipRadar / HustleLedger so the dashboard reads as one system.
 */
export function GoalsPanel({
  goals,
  currency,
  onManage,
}: {
  goals: Goal[];
  currency: Currency;
  /** Open the Manage sheet (shown as "View all" once past VISIBLE). */
  onManage?: () => void;
}) {
  const overflow = onManage && goals.length > VISIBLE;
  const shown = overflow ? goals.slice(0, VISIBLE) : goals;

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center gap-2 text-muted">
        <TargetIcon className="h-3.5 w-3.5" />
        <h2 className="label-caps text-[11px]">Goals</h2>
      </div>

      <ul className="mt-4 space-y-4">
        {shown.map((g) => {
          const pct = goalProgressPct(g);
          const done = isGoalComplete(g);
          return (
            <li key={g.id}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium">{g.name}</p>
                <span className="font-data shrink-0 text-xs text-muted">
                  {formatMoneyCompact(g.savedAmount, currency)} /{" "}
                  {formatMoneyCompact(g.targetAmount, currency)}
                </span>
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg/60">
                <div
                  className="h-full rounded-full bg-emerald transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mt-1.5 flex items-center justify-between">
                {done ? (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald">
                    <CheckIcon className="h-3 w-3" />
                    Target reached
                  </span>
                ) : (
                  <span className="text-[11px] text-muted">
                    {formatMoney(goalRemaining(g), currency)} to go
                  </span>
                )}
                <span className="font-data text-[11px] text-muted">
                  {Math.round(pct)}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {overflow && (
        <button
          type="button"
          onClick={onManage}
          className="mt-4 w-full border-t border-line pt-3 text-xs text-muted transition-colors hover:text-ink"
        >
          View all ({goals.length}) →
        </button>
      )}
    </section>
  );
}

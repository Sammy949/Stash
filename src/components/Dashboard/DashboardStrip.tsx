import type { Ledger } from "@/types";
import { balance, daysUntil, radarBadge } from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";

/**
 * Condensed dashboard shown while the agent panel is open (Split-Shift):
 * key numbers stay visible, and tapping it expands back to the full
 * dashboard.
 */
export function DashboardStrip({
  ledger,
  onExpand,
}: {
  ledger: Ledger;
  onExpand: () => void;
}) {
  const bal = balance(ledger);

  const next = ledger.scholarships
    .filter((s) => s.deadline)
    .map((s) => ({ s, d: daysUntil(s.deadline!) }))
    .filter((x) => x.d >= 0)
    .sort((a, b) => a.d - b.d)[0]?.s;

  return (
    <button
      onClick={onExpand}
      className="flex w-full items-center gap-4 border-b border-line bg-card/60 px-5 py-3 text-left transition-colors hover:bg-card"
    >
      <div className="min-w-0">
        <span className="block text-[11px] text-muted">Balance</span>
        <span className="block text-base font-semibold tabular-nums">
          {formatMoney(bal, ledger.currency)}
        </span>
      </div>

      {next && (
        <div className="min-w-0 border-l border-line pl-4">
          <span className="block truncate text-[11px] text-muted">
            {next.name}
          </span>
          <span className="block text-sm font-medium text-emerald tabular-nums">
            {radarBadge(next)}
          </span>
        </div>
      )}

      <span className="ml-auto shrink-0 text-xs text-muted">Dashboard ▴</span>
    </button>
  );
}

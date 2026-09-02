import type { SpendingBreakdown } from "@/types";
import { formatMoney } from "@/lib/currency";

/**
 * Inline spending-breakdown card — the chat's rich structured reply. Every
 * figure here is code-computed (see analyzeSpending); the model never touches
 * these numbers.
 */
export function SpendingCard({ data }: { data: SpendingBreakdown }) {
  return (
    <div className="w-full max-w-[18rem] rounded-2xl border border-border bg-card/80 p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-caps text-[10px] text-muted-foreground">
          Spending · last {data.windowDays} days
        </span>
        <span className="font-data text-sm font-semibold text-foreground">
          {formatMoney(data.total, data.currency)}
        </span>
      </div>

      <ul className="mt-3 space-y-2.5">
        {data.rows.map((row, i) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className={i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
                {row.label}
              </span>
              <span className="font-data text-muted-foreground">
                {formatMoney(row.amount, data.currency)} · {row.pct}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
              <div
                className={`h-full rounded-full ${
                  i === 0 ? "bg-primary" : "bg-primary/35"
                }`}
                style={{ width: `${Math.max(row.pct, 2)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{data.topLabel}</span> is your
        biggest category: {data.topShare}% of the last {data.windowDays} days.
      </p>
    </div>
  );
}

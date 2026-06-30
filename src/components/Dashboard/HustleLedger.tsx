import type { Currency, Hustle, HustleStatus } from "@/types";
import { totalActiveIncome } from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";
import { BoltIcon } from "@/components/UI/icons";
import { EmptyState } from "@/components/UI/EmptyState";

/** Status → pill styling (literal class strings for Tailwind scanning). */
const STATUS_PILL: Record<HustleStatus, string> = {
  received: "border-emerald/30 bg-emerald/10 text-emerald",
  active: "border-emerald/30 bg-emerald/10 text-emerald",
  pending: "border-amber/30 bg-amber/10 text-amber",
  building: "border-line bg-bg/40 text-muted",
};

const STATUS_LABEL: Record<HustleStatus, string> = {
  received: "Received",
  active: "Active",
  pending: "Pending",
  building: "Building",
};

const VISIBLE = 2;

export function HustleLedger({
  hustles,
  currency,
  onManage,
}: {
  hustles: Hustle[];
  currency: Currency;
  /** Open the Manage sheet (shown as "View all" once past VISIBLE). */
  onManage?: () => void;
}) {
  const activeIncome = totalActiveIncome(hustles);
  const overflow = onManage && hustles.length > VISIBLE;
  const shown = overflow ? hustles.slice(0, VISIBLE) : hustles;

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center gap-2 text-muted">
        <BoltIcon className="h-3.5 w-3.5" />
        <h2 className="label-caps text-[11px]">Hustle Ledger</h2>
      </div>

      {hustles.length === 0 && (
        <EmptyState
          icon={<BoltIcon className="h-4 w-4" />}
          title="Track your side income"
          hint="Tell Stash: “I make ₦40,000 a month tutoring.”"
        />
      )}

      <ul className="mt-4 space-y-1">
        {shown.map((h) => (
          <li
            key={h.id}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-bg/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{h.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted">
                  {h.tag}
                </span>
                <span className="font-data text-xs text-muted">
                  {h.amountLabel}
                </span>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_PILL[h.status]}`}
            >
              {STATUS_LABEL[h.status]}
            </span>
          </li>
        ))}
      </ul>

      {hustles.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="label-caps text-[11px] text-muted">Active income</span>
          <span className="font-data text-sm font-semibold text-emerald">
            {formatMoney(activeIncome, currency)}/mo
          </span>
        </div>
      )}

      {overflow && (
        <button
          type="button"
          onClick={onManage}
          className="mt-3 w-full text-xs text-muted transition-colors hover:text-ink"
        >
          View all ({hustles.length}) →
        </button>
      )}
    </section>
  );
}

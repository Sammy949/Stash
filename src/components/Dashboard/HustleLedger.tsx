import type { Currency, Hustle, HustleStatus } from "@/types";
import { totalActiveIncome } from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";
import { BoltIcon } from "@/components/UI/icons";

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

export function HustleLedger({
  hustles,
  currency,
}: {
  hustles: Hustle[];
  currency: Currency;
}) {
  const activeIncome = totalActiveIncome(hustles);

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Hustle Ledger</h2>
        <BoltIcon className="h-4 w-4 text-amber" />
      </div>

      {hustles.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
          No income streams yet.
        </p>
      )}

      <ul className="mt-4 space-y-1">
        {hustles.map((h) => (
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
                <span className="text-xs text-muted tabular-nums">
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
          <span className="text-xs text-muted">Active income</span>
          <span className="text-sm font-semibold text-emerald tabular-nums">
            {formatMoney(activeIncome, currency)}/mo
          </span>
        </div>
      )}
    </section>
  );
}

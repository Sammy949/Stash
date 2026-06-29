import { useState } from "react";
import type { Currency, Transaction } from "@/types";
import { formatMoney } from "@/lib/currency";
import { ReceiptIcon } from "@/components/UI/icons";

const PREVIEW = 3;

/** "29 Jun" — compact day+month for the row timestamp. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Recent activity — a read-only audit trail, not a control surface. It exists
 * so the numbers stay verifiable (money must be auditable), but it doesn't
 * scream: the latest few entries show by default, "View all" reveals the rest.
 *
 * Corrections don't happen here — you fix a mistake by editing the chat
 * message that logged it, which rewinds and re-runs from the right state.
 * Transactions are proof, not the product.
 */
export function TransactionList({
  transactions,
  currency,
}: {
  transactions: Transaction[];
  currency: Currency;
}) {
  const [expanded, setExpanded] = useState(false);

  // Newest first. Copy before sort — never mutate the ledger array in place.
  const ordered = [...transactions].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const shown = expanded ? ordered : ordered.slice(0, PREVIEW);

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Recent Activity</h2>
        <ReceiptIcon className="h-4 w-4 text-muted" />
      </div>

      {ordered.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
          No transactions yet.
        </p>
      )}

      <ul className="mt-4 space-y-1">
        {shown.map((t) => {
          const income = t.type === "income";
          const chip = t.category ?? t.tag ?? (income ? "income" : "other");
          return (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.label}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] capitalize text-muted">
                    {chip}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {shortDate(t.createdAt)}
                  </span>
                </div>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  income ? "text-emerald" : "text-ink"
                }`}
              >
                {income ? "+" : "−"}
                {formatMoney(t.amount, currency)}
              </span>
            </li>
          );
        })}
      </ul>

      {ordered.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full border-t border-line pt-3 text-xs text-muted transition-colors hover:text-ink"
        >
          {expanded ? "Show less" : `View all (${ordered.length}) →`}
        </button>
      )}
    </section>
  );
}

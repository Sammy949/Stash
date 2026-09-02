import { useState } from "react";
import type { Currency, Transaction } from "@/types";
import { formatMoney } from "@/lib/currency";
import { ReceiptIcon } from "@/components/UI/icons";
import { EmptyState } from "@/components/UI/EmptyState";

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
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <ReceiptIcon className="h-3.5 w-3.5" />
        <h2 className="label-caps text-[11px]">Recent Activity</h2>
      </div>

      {ordered.length === 0 && (
        <EmptyState
          icon={<ReceiptIcon className="h-4 w-4" />}
          title="No activity yet"
          hint="Log your first one: “I spent ₦3,000 on lunch.”"
        />
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
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                    {chip}
                  </span>
                  <span className="font-data text-xs text-muted-foreground">
                    {shortDate(t.createdAt)}
                  </span>
                </div>
              </div>
              <span
                className={`font-data shrink-0 text-sm font-semibold ${
                  income ? "text-primary" : "text-foreground"
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
          className="mt-3 w-full border-t border-border pt-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? "Show less" : `View all (${ordered.length}) →`}
        </button>
      )}
    </section>
  );
}

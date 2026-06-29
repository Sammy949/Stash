import { useState } from "react";
import type { Currency, Transaction } from "@/types";
import { formatMoney } from "@/lib/currency";
import {
  CheckIcon,
  CloseIcon,
  PencilIcon,
  ReceiptIcon,
  TrashIcon,
} from "@/components/UI/icons";
import { RowButton } from "@/components/UI/RowButton";

const PAGE = 10;

/** "29 Jun" — compact day+month for the row timestamp. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Recent transactions with inline edit + delete — the only manual correction
 * path for entries logged more than one step ago (and the repair path for the
 * k/m-shorthand parsing bug). Minimal by design: newest first, capped at the
 * 10 most recent with a "show more" toggle.
 *
 * Editing/deleting only mutates the transactions array; balance, runway, and
 * %-spent recompute automatically since they're derived — never stored.
 */
export function TransactionList({
  transactions,
  currency,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[];
  currency: Currency;
  onEdit: (id: string, patch: { amount?: number; label?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Per-row UI state — at most one row is editing or confirming-delete.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [draftAmount, setDraftAmount] = useState("");
  const [draftLabel, setDraftLabel] = useState("");

  // Newest first. Copy before sort — never mutate the ledger array in place.
  const ordered = [...transactions].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const shown = expanded ? ordered : ordered.slice(0, PAGE);

  function startEdit(t: Transaction) {
    setConfirmId(null);
    setEditingId(t.id);
    setDraftAmount(String(t.amount));
    setDraftLabel(t.label);
  }

  function saveEdit(id: string) {
    onEdit(id, { amount: Number(draftAmount), label: draftLabel });
    setEditingId(null);
  }

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

          // ── Editing state: amount + description inputs ──────────────
          if (editingId === t.id) {
            return (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-xl bg-bg/40 px-2 py-2"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <input
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    placeholder="Description"
                    className="w-full rounded-lg border border-line bg-bg px-2 py-1 text-sm text-ink outline-none focus:border-emerald"
                  />
                  <input
                    value={draftAmount}
                    onChange={(e) => setDraftAmount(e.target.value)}
                    inputMode="numeric"
                    placeholder="Amount"
                    className="w-full rounded-lg border border-line bg-bg px-2 py-1 text-sm tabular-nums text-ink outline-none focus:border-emerald"
                  />
                </div>
                <RowButton
                  label="Save changes"
                  tone="emerald"
                  onClick={() => saveEdit(t.id)}
                >
                  <CheckIcon className="h-4 w-4" />
                </RowButton>
                <RowButton label="Cancel" onClick={() => setEditingId(null)}>
                  <CloseIcon className="h-4 w-4" />
                </RowButton>
              </li>
            );
          }

          // ── Delete-confirm state ───────────────────────────────────
          if (confirmId === t.id) {
            return (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-xl bg-red/5 px-2 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-muted">
                  Delete “{t.label}”?
                </span>
                <RowButton
                  label="Confirm delete"
                  tone="red"
                  onClick={() => {
                    onDelete(t.id);
                    setConfirmId(null);
                  }}
                >
                  <CheckIcon className="h-4 w-4" />
                </RowButton>
                <RowButton label="Keep" onClick={() => setConfirmId(null)}>
                  <CloseIcon className="h-4 w-4" />
                </RowButton>
              </li>
            );
          }

          // ── Default display row (actions appear on hover) ──────────
          return (
            <li
              key={t.id}
              className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-bg/40"
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
              {/* Actions — hidden until row hover (always shown on touch). */}
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <RowButton label="Edit" onClick={() => startEdit(t)}>
                  <PencilIcon className="h-4 w-4" />
                </RowButton>
                <RowButton
                  label="Delete"
                  tone="red"
                  onClick={() => {
                    setEditingId(null);
                    setConfirmId(t.id);
                  }}
                >
                  <TrashIcon className="h-4 w-4" />
                </RowButton>
              </div>
            </li>
          );
        })}
      </ul>

      {ordered.length > PAGE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full border-t border-line pt-3 text-xs text-muted transition-colors hover:text-ink"
        >
          {expanded ? "Show less" : `Show ${ordered.length - PAGE} more`}
        </button>
      )}
    </section>
  );
}

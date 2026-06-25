import type { Ledger, SyncPhase } from "@/types";
import {
  balance,
  formatSyncedAt,
  outflowPct,
  totalExpenses,
  totalIncome,
} from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";
import { AnimatedNumber } from "@/components/UI/AnimatedNumber";
import { SyncIndicator } from "@/components/UI/SyncIndicator";
import { LockIcon } from "@/components/UI/icons";

const RING_SIZE = 168;
const STROKE = 12;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function VaultCard({
  ledger,
  syncPhase = "idle",
  hydrating = false,
}: {
  ledger: Ledger;
  syncPhase?: SyncPhase;
  hydrating?: boolean;
}) {
  const bal = balance(ledger);
  const income = totalIncome(ledger);
  const expenses = totalExpenses(ledger);
  const pct = outflowPct(ledger);
  const ringLabel = ledger.monthlyBudget ? "of budget spent" : "of income spent";
  const offset = CIRCUMFERENCE * (1 - pct / 100);

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Stash Vault</h2>
        <LockIcon className="h-4 w-4 text-emerald" />
        <span className="ml-auto">
          {syncPhase === "idle" ? (
            <span className="text-xs text-muted">Secured on 0G Storage</span>
          ) : (
            <SyncIndicator phase={syncPhase} />
          )}
        </span>
      </div>

      {/* Ring */}
      <div className="mt-5 flex justify-center">
        <div
          className="relative"
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            className="-rotate-90"
            aria-hidden
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-line)"
              strokeWidth={STROKE}
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={bal < 0 ? "var(--color-red)" : "var(--color-emerald)"}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              style={{
                transition: "stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="text-[11px] text-muted">Balance</span>
            <AnimatedNumber
              value={bal}
              format={(n) => formatMoney(n, ledger.currency)}
              className={`text-2xl font-semibold tabular-nums ${bal < 0 ? "text-red" : ""}`}
            />
            <span className="mt-0.5 text-[11px] text-muted">
              {bal < 0 ? "You're in the red" : `${Math.round(pct)}% ${ringLabel}`}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-2 text-center">
        <Stat label="Income" value={income} accent="emerald" currency={ledger.currency} />
        <Stat label="Expenses" value={expenses} accent="amber" currency={ledger.currency} />
      </div>

      {/* Footer */}
      <p className="mt-4 text-center text-[11px] text-muted">
        {hydrating
          ? "Restoring from 0G Storage…"
          : ledger.transactions.length === 0
            ? "Tell Stash about your money below to get started."
            : formatSyncedAt(ledger.lastSyncedAt)}
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
  currency,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "amber";
  currency: Ledger["currency"];
}) {
  const color =
    accent === "emerald"
      ? "text-emerald"
      : accent === "amber"
        ? "text-amber"
        : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-bg/40 px-2 py-3">
      <AnimatedNumber
        value={value}
        format={(n) => formatMoney(n, currency)}
        className={`block text-sm font-semibold tabular-nums ${color}`}
      />
      <span className="mt-1 block text-[11px] text-muted">{label}</span>
    </div>
  );
}

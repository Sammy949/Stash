import type { ReactNode } from "react";
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
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  LockIcon,
} from "@/components/UI/icons";

// Compact "spent" ring — a secondary indicator in the top-right, not the
// centerpiece (the balance is). Small + thin to read as a status gauge.
const RING_SIZE = 78;
const STROKE = 7;
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
  const overdrawn = bal < 0;
  const offset = CIRCUMFERENCE * (1 - pct / 100);

  return (
    <section className="rounded-2xl border border-line bg-card p-6">
      {/* Top region: balance dominant on the left, spent ring on the right. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-muted">
            <span className="label-caps text-[11px]">Vault Balance</span>
            <LockIcon className="h-3 w-3" />
          </div>

          <AnimatedNumber
            value={bal}
            format={(n) => formatMoney(n, ledger.currency)}
            className={`font-data mt-2 block text-[clamp(1.6rem,7vw,2.6rem)] font-semibold leading-[1.1] ${
              overdrawn ? "text-red" : "text-ink"
            }`}
          />

          {/* Sync / persistence status — one quiet line under the balance. */}
          <div className="mt-3 h-4 text-xs">
            {hydrating ? (
              <span className="text-muted">Restoring from 0G Storage…</span>
            ) : syncPhase === "idle" ? (
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                {formatSyncedAt(ledger.lastSyncedAt)}
              </span>
            ) : (
              <SyncIndicator phase={syncPhase} />
            )}
          </div>
        </div>

        {/* Spent ring */}
        <div
          className="relative shrink-0"
          style={{ width: RING_SIZE, height: RING_SIZE }}
          role="img"
          aria-label={
            overdrawn ? "Overdrawn" : `${Math.round(pct)} percent spent`
          }
        >
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90" aria-hidden>
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
              stroke={overdrawn ? "var(--color-red)" : "var(--color-emerald)"}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              className="[transition:stroke-dashoffset_0.7s_cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="label-caps text-[8px] text-muted">Spent</span>
            <span className="font-data text-sm font-semibold leading-tight">
              {Math.round(pct)}%
            </span>
          </div>
        </div>
      </div>

      {/* Inflow / outflow tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat
          label="Income"
          value={income}
          currency={ledger.currency}
          icon={<ArrowDownLeftIcon className="h-3.5 w-3.5" />}
          accent
        />
        <Stat
          label="Expenses"
          value={expenses}
          currency={ledger.currency}
          icon={<ArrowUpRightIcon className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Empty-first nudge — only before any money is logged. */}
      {!hydrating && ledger.transactions.length === 0 && (
        <p className="mt-4 text-center text-[11px] text-muted">
          Tell Stash about your money below to get started.
        </p>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  currency,
  icon,
  accent = false,
}: {
  label: string;
  value: number;
  currency: Ledger["currency"];
  icon: ReactNode;
  /** Income tile gets the blue accent; expenses stay neutral (amber/red are
   *  reserved strictly for warnings). */
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg/40 p-3">
      <div className="flex items-center gap-1.5 text-muted">
        <span className={accent ? "text-emerald" : ""}>{icon}</span>
        <span className="label-caps text-[10px]">{label}</span>
      </div>
      <AnimatedNumber
        value={value}
        format={(n) => formatMoney(n, currency)}
        className={`font-data mt-1.5 block text-lg font-semibold ${
          accent ? "text-emerald" : "text-ink"
        }`}
      />
    </div>
  );
}

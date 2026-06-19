import type { Ledger } from "@/types";
import {
  formatNaira,
  formatSyncedAt,
  remaining,
  spentPct,
} from "@/lib/ledger";
import { AnimatedNumber } from "@/components/UI/AnimatedNumber";
import { LockIcon } from "@/components/UI/icons";

const RING_SIZE = 168;
const STROKE = 12;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function VaultCard({ ledger }: { ledger: Ledger }) {
  const { budget } = ledger;
  const pct = spentPct(budget);
  const left = remaining(budget);
  const offset = CIRCUMFERENCE * (1 - pct / 100);

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Stash Vault</h2>
        <LockIcon className="h-4 w-4 text-emerald" />
        <span className="ml-auto text-xs text-muted">Secured on 0G Storage</span>
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
              stroke="var(--color-emerald)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              style={{
                transition: "stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatedNumber
              value={Math.round(pct)}
              format={(n) => `${n}%`}
              className="text-3xl font-semibold tabular-nums"
            />
            <span className="mt-0.5 text-xs text-muted">of budget spent</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Stat label="Budget" value={budget.total} />
        <Stat label="Spent" value={budget.spent} accent="amber" />
        <Stat label="Remaining" value={left} accent="emerald" />
      </div>

      {/* Footer */}
      <p className="mt-4 text-center text-[11px] text-muted">
        {formatSyncedAt(ledger.lastSyncedAt)}
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "amber";
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
        format={formatNaira}
        className={`block text-sm font-semibold tabular-nums ${color}`}
      />
      <span className="mt-1 block text-[11px] text-muted">{label}</span>
    </div>
  );
}

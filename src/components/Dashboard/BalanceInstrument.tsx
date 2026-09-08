import type { Ledger, SyncPhase } from "@/types";
import {
  balance,
  balanceSeries,
  formatSyncedAt,
  totalExpenses,
  totalIncome,
} from "@/lib/ledger";
import { formatMoney } from "@/lib/currency";
import { AnimatedNumber } from "@/components/UI/AnimatedNumber";
import { SyncIndicator } from "@/components/UI/SyncIndicator";
import { Card, CardContent } from "@/components/shadcn/card";
import { Skeleton } from "@/components/shadcn/skeleton";
import { traceGeometry, VIEW_H, VIEW_W } from "./traceGeometry";

const WINDOW_DAYS = 30;

/**
 * The balance instrument — Stash's signature artifact, and the one thing on the
 * dashboard that could not be pasted into another product.
 *
 * It is the product's own data drawn as a measuring instrument: the balance as
 * the headline figure, a 30-day running-balance trace beneath it, and the two
 * flows stated plainly. The trace is bespoke SVG because data visualisation is
 * the one place drawing is correct rather than lazy; every number in it comes
 * from `balanceSeries`, which is proven to end exactly on `balance()`.
 *
 * Empty is the SAME instrument, calibrated and waiting: the axis is drawn, the
 * figures read zero, and one line names the gesture that starts it. Stash is
 * empty-first, so this state is the first thing most people see.
 */
export function BalanceInstrument({
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
  const overdrawn = bal < 0;
  const started = ledger.transactions.length > 0;

  const series = balanceSeries(ledger, WINDOW_DAYS);
  const geo = traceGeometry(series);

  return (
    <Card className="relative">
      <CardContent className="relative z-10">
        <div className="label-caps text-[10px] text-muted-foreground">
          Balance
        </div>

        {hydrating ? (
          <Skeleton className="mt-2 h-10 w-48" />
        ) : (
          <AnimatedNumber
            value={bal}
            format={(n) => formatMoney(n, ledger.currency)}
            // cqi, not vw: the figure has to size against the column it sits
            // in. In the lg two-pane layout the dashboard is ~40% of the
            // window, so 8vw kept scaling with the whole screen and a long
            // amount would have run under the card's overflow-hidden edge.
            // (With no container ancestor — the preview harness — cqi falls
            // back to the viewport, which is the old behaviour.)
            className={`font-data mt-1 block text-[clamp(2rem,9cqi,3.25rem)] font-semibold leading-none tracking-[-0.02em] ${
              overdrawn ? "text-destructive" : "text-foreground"
            }`}
          />
        )}

        <div className="mt-2.5 h-4 text-xs">
          {hydrating ? (
            <span className="text-muted-foreground">Restoring your ledger…</span>
          ) : syncPhase === "idle" ? (
            <span className="text-muted-foreground">
              {formatSyncedAt(ledger.lastSyncedAt)}
            </span>
          ) : (
            <SyncIndicator phase={syncPhase} />
          )}
        </div>
      </CardContent>

      {/* The trace. Bleeds the full width of the card and sits behind the
          figures, so the instrument reads as one object rather than a chart
          bolted under a number. */}
      <Trace geo={geo} started={started} overdrawn={overdrawn} />

      <CardContent className="relative z-10">
        <div className="flex items-baseline justify-between gap-4">
          <Flow label="In" value={income} currency={ledger.currency} started={started} tone="in" />
          <div className="h-8 w-px shrink-0 bg-border" aria-hidden />
          <Flow label="Out" value={expenses} currency={ledger.currency} started={started} tone="out" />
        </div>

        {!hydrating && !started && (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Nothing measured yet. Tell Stash{" "}
            <span className="text-foreground">&ldquo;got paid 600&rdquo;</span> or{" "}
            <span className="text-foreground">&ldquo;spent 12 on transport&rdquo;</span>{" "}
            and the trace starts here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The trace itself.
 *
 * Draw-on motion is a CSS animation that runs BACKWARDS from a hidden start to
 * the path's resting state, which is fully drawn. Nothing about the trace's
 * existence depends on the animation running: if it never runs, or is
 * interrupted, the line is complete. The earlier version transitioned a React
 * state from hidden to drawn, which could be caught part-way — measured at
 * stroke-dashoffset 0.917 on a real page load — leaving a stroke that stopped
 * short of its own filled area, which is the half-built-motion tell.
 */
function Trace({
  geo,
  started,
  overdrawn,
}: {
  geo: ReturnType<typeof traceGeometry>;
  started: boolean;
  overdrawn: boolean;
}) {
  const stroke = overdrawn ? "var(--destructive)" : "var(--foreground)";

  return (
    <div className="relative -my-2 h-24 w-full sm:h-28" aria-hidden>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        {/* Calibration baseline. Present in BOTH states, which is what makes the
            empty instrument read as waiting rather than broken. Dashed while
            there is nothing to measure, solid once there is. */}
        <line
          x1="0"
          y1={VIEW_H - 1}
          x2={VIEW_W}
          y2={VIEW_H - 1}
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray={started ? undefined : "3 5"}
          vectorEffect="non-scaling-stroke"
        />

        {geo && started && (
          <>
            {/* Zero crossing, only when the balance actually went negative. */}
            {geo.zeroY !== null && (
              <line
                x1="0"
                y1={geo.zeroY}
                x2={VIEW_W}
                y2={geo.zeroY}
                stroke="var(--destructive)"
                strokeWidth="1"
                strokeDasharray="2 4"
                opacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Weight under the line. Kept faint: it is there to give the stroke
                body, not to be a filled chart. */}
            <path d={geo.area} fill={stroke} opacity="0.06" />

            <path
              className="animate-trace-draw"
              d={geo.line}
              fill="none"
              stroke={stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              // pathLength normalises the dash maths: the path is 1 unit long
              // regardless of its real length, so one offset works for any data.
              pathLength={1}
              strokeDasharray={1}
              // Resting state: fully drawn. The animation supplies the hidden
              // start, never the finished state.
              strokeDashoffset={0}
            />
          </>
        )}
      </svg>
    </div>
  );
}

/** One flow figure. Income carries the money-in colour; outflow is neutral ink,
 *  because colouring every expense as alarming would cry wolf. */
function Flow({
  label,
  value,
  currency,
  started,
  tone,
}: {
  label: string;
  value: number;
  currency: Ledger["currency"];
  started: boolean;
  tone: "in" | "out";
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="label-caps text-[10px] text-muted-foreground">{label}</div>
      {started ? (
        <AnimatedNumber
          value={value}
          format={(n) => `${tone === "in" ? "+" : "−"}${formatMoney(n, currency)}`}
          className={`font-data mt-1 block truncate text-base font-medium ${
            tone === "in" ? "text-success" : "text-foreground"
          }`}
        />
      ) : (
        // A dash, not a zero: nothing has been measured, which is not the same
        // as having measured zero.
        <span className="font-data mt-1 block text-base font-medium text-muted-foreground">
          &mdash;
        </span>
      )}
    </div>
  );
}

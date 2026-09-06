import { useState } from "react";
import type { Ledger, Transaction } from "@/types";
import { EMPTY_LEDGER, balance, balanceSeries } from "@/lib/ledger";
import { BalanceInstrument } from "@/components/Dashboard/BalanceInstrument";
import { formatMoney } from "@/lib/currency";
import { Card, CardContent } from "@/components/shadcn/card";
import { useTheme } from "@/hooks/useTheme";

/**
 * Internal design review surface, reached with `?preview`.
 *
 * Exists so design decisions get looked at before they are committed across the
 * app, rather than being taken on my judgement alone. Not part of the product:
 * lazy-loaded, so it costs the shipped bundle nothing, and removed before merge.
 */

const DAY = 86_400_000;

/** A believable 30 days of student money: irregular income, small daily spends. */
function demoLedger(): Ledger {
  const now = Date.now();
  const tx = (
    dayOffset: number,
    type: Transaction["type"],
    amount: number,
    label: string,
  ): Transaction => ({
    id: `${label}-${dayOffset}`,
    type,
    amount,
    label,
    createdAt: new Date(now - dayOffset * DAY).toISOString(),
  });

  return {
    ...EMPTY_LEDGER,
    owner: "Samuel",
    currency: "GBP",
    openingBalance: 240,
    transactions: [
      tx(27, "income", 480, "Kayo brand sprint"),
      tx(26, "expense", 62.4, "Groceries"),
      tx(24, "expense", 14, "Transport"),
      tx(21, "expense", 38.9, "Textbook"),
      tx(19, "expense", 21.5, "Data bundle"),
      tx(16, "income", 120, "Tutoring, two sessions"),
      tx(15, "expense", 47.2, "Groceries"),
      tx(12, "expense", 9.5, "Print credits"),
      tx(9, "income", 610, "Northwind retainer"),
      tx(8, "expense", 128, "Rent share"),
      tx(6, "expense", 33.75, "Groceries"),
      tx(4, "expense", 18.4, "Transport"),
      tx(2, "expense", 26, "Coffee and lunch"),
      tx(0, "expense", 11.2, "Data bundle"),
    ],
  };
}

/** Overdrawn, so the zero crossing and the destructive tone can be checked. */
function overdrawnLedger(): Ledger {
  const now = Date.now();
  return {
    ...EMPTY_LEDGER,
    currency: "GBP",
    openingBalance: 90,
    transactions: [
      {
        id: "a",
        type: "expense",
        amount: 140,
        label: "Emergency repair",
        createdAt: new Date(now - 6 * DAY).toISOString(),
      },
      {
        id: "b",
        type: "expense",
        amount: 60,
        label: "Groceries",
        createdAt: new Date(now - 2 * DAY).toISOString(),
      },
    ],
  };
}

/** Opening balance, nothing logged: the "steady" case the trace probe caught. */
function steadyLedger(): Ledger {
  return { ...EMPTY_LEDGER, currency: "GBP", openingBalance: 500 };
}

export default function Preview() {
  const { theme, setTheme } = useTheme();
  const [days, setDays] = useState(30);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
        <h1 className="font-data text-sm font-semibold">Stash design review</h1>
        <span className="label-caps text-[10px] text-muted-foreground">
          internal, not shipped
        </span>
        <div className="ml-auto flex items-center gap-1">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`rounded-md px-2.5 py-1 text-xs capitalize transition-colors ${
                theme === t
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-12 px-6 py-10">
        <Section
          title="1 · The instrument"
          note="Same component in every state. Empty is the instrument calibrated and waiting, not a different screen."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <Labelled label="Empty (a new user, before anything is logged)">
              <BalanceInstrument ledger={EMPTY_LEDGER} />
            </Labelled>
            <Labelled label="Populated (30 days of irregular income)">
              <BalanceInstrument ledger={demoLedger()} />
            </Labelled>
            <Labelled label="Steady (opening balance, nothing logged since)">
              <BalanceInstrument ledger={steadyLedger()} />
            </Labelled>
            <Labelled label="Overdrawn (must visibly cross zero)">
              <BalanceInstrument ledger={overdrawnLedger()} />
            </Labelled>
            <Labelled label="Hydrating (restoring from storage)">
              <BalanceInstrument ledger={demoLedger()} hydrating />
            </Labelled>
            <Labelled label="Syncing">
              <BalanceInstrument ledger={demoLedger()} syncPhase="uploading" />
            </Labelled>
          </div>
        </Section>

        <Section
          title="2 · The trace, against its own numbers"
          note="The last point of the trace must equal the balance exactly. Proven in notes/qa/series-probe.mjs; shown here so it can be read off the screen too."
        >
          <SeriesTable days={days} onDays={setDays} />
        </Section>

        <Section
          title="3 · Palette"
          note="One hue (75) at chroma <= 0.008 carries every surface and ink. Colour appears only where it means something about money."
        >
          <Swatches />
        </Section>

        <Section
          title="4 · Radius"
          note="Three steps, by meaning. Tailwind's xl and 2xl are pinned to the container step so vendored code cannot introduce a fourth."
        >
          <Radii />
        </Section>

        <Section
          title="5 · Type"
          note="Geist for prose, Geist Mono for every figure. The mono is load-bearing here rather than decorative."
        >
          <TypeScale />
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      {note && (
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {note}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="label-caps mb-2 text-[10px] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

/** Every token, as a swatch, with the role it is allowed to carry. */
const TOKENS: { name: string; role: string; money?: boolean }[] = [
  { name: "background", role: "the page" },
  { name: "card", role: "a panel on the page" },
  { name: "secondary", role: "a surface on a panel" },
  { name: "muted", role: "same step, shadcn's surface name" },
  { name: "accent", role: "hover / selected surface" },
  { name: "border", role: "the self-coloured edge" },
  { name: "foreground", role: "primary ink" },
  { name: "muted-foreground", role: "quiet ink" },
  { name: "primary", role: "interactive emphasis (a lightness step, NOT a hue)" },
  { name: "success", role: "money in, money secured", money: true },
  { name: "destructive", role: "overdrawn only, never routine spend", money: true },
  { name: "warning", role: "warnings only", money: true },
];

function Swatches() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {TOKENS.map((t) => (
        <div
          key={t.name}
          className="flex items-center gap-3 rounded-lg bg-card p-3 ring-1 ring-foreground/10"
        >
          <div
            className="size-10 shrink-0 rounded-md ring-1 ring-foreground/10"
            style={{ background: `var(--${t.name})` }}
          />
          <div className="min-w-0">
            <div className="font-data text-xs font-medium">
              {t.name}
              {t.money && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  money
                </span>
              )}
            </div>
            <div className="text-[11px] leading-snug text-muted-foreground">
              {t.role}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Radii() {
  const steps = [
    { cls: "rounded-sm", label: "sm", use: "figures, chips, inner tiles, bars" },
    { cls: "rounded-md", label: "md", use: "buttons, inputs, menu items" },
    { cls: "rounded-lg", label: "lg", use: "cards, sheets, panels" },
  ];
  return (
    <div className="flex flex-wrap gap-4">
      {steps.map((s) => (
        <div key={s.cls} className="w-52">
          <div
            className={`${s.cls} flex h-20 items-center justify-center bg-card ring-1 ring-foreground/10`}
          >
            <span className="font-data text-xs text-muted-foreground">
              {s.label}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            {s.use}
          </p>
        </div>
      ))}
    </div>
  );
}

function TypeScale() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <div className="label-caps text-[10px] text-muted-foreground">
            Balance, the headline figure
          </div>
          <div className="font-data text-[clamp(2rem,8vw,3.25rem)] font-semibold leading-none tracking-[-0.02em]">
            {formatMoney(1284.5, "GBP")}
          </div>
        </div>
        <div>
          <div className="label-caps text-[10px] text-muted-foreground">
            A flow figure
          </div>
          <div className="font-data text-base font-medium text-success">
            +{formatMoney(610, "GBP")}
          </div>
        </div>
        <div>
          <div className="label-caps text-[10px] text-muted-foreground">
            label-caps, for data labels only
          </div>
        </div>
        <div>
          <p className="max-w-prose text-sm leading-relaxed">
            And this is Geist, carrying prose. The agent speaks in this: you have
            enough for the month, and the Northwind payment landed nine days ago.
            Figures inside a sentence still switch to mono, like{" "}
            <span className="font-data">{formatMoney(610, "GBP")}</span>, so a
            number is always recognisable as one.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
/** Reads the real series back as a table, so the trace can be checked by eye. */
function SeriesTable({
  days,
  onDays,
}: {
  days: number;
  onDays: (n: number) => void;
}) {
  const ledger = demoLedger();
  const series = balanceSeries(ledger, days);
  const bal = balance(ledger);
  const last = series[series.length - 1]?.balance ?? 0;
  const agrees = Math.abs(last - bal) < 1e-9;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDays(d)}
              className={`font-data rounded-md px-2.5 py-1 text-xs transition-colors ${
                days === d
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        <div
          className={`font-data text-xs ${agrees ? "text-success" : "text-destructive"}`}
        >
          last point {formatMoney(last, "GBP")} {agrees ? "===" : "!=="} balance{" "}
          {formatMoney(bal, "GBP")}
        </div>

        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="label-caps sticky top-0 bg-card text-[9px] text-muted-foreground">
              <tr>
                <th className="py-1 font-normal">Day</th>
                <th className="py-1 text-right font-normal">Balance</th>
              </tr>
            </thead>
            <tbody className="font-data text-xs">
              {series.map((p) => (
                <tr key={p.t} className="border-t border-border/50">
                  <td className="py-1 text-muted-foreground">
                    {new Date(p.t).toLocaleDateString(undefined, {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(p.balance, "GBP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import type { Ledger, Transaction } from "@/types";
import { EMPTY_LEDGER, balance, balanceSeries } from "@/lib/ledger";
import { deriveAttention } from "@/lib/attention";
import { BalanceInstrument } from "@/components/Dashboard/BalanceInstrument";
import { AttentionSlot } from "@/components/Dashboard/AttentionSlot";
import { TrackingStrip } from "@/components/Dashboard/TrackingStrip";
import { formatMoney } from "@/lib/currency";
import { Card, CardContent } from "@/components/shadcn/card";
import { useTheme } from "@/hooks/useTheme";
import { Onboarding } from "@/components/Onboarding/Onboarding";
import {
  INCOME_SHAPES,
  type OnboardingProfile,
} from "@/components/Onboarding/onboardingModel";

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

/** Two deadlines, the nearer one inside the red band, so the slot has to pick. */
function deadlineLedger(): Ledger {
  const at = (days: number) =>
    new Date(Date.now() + days * DAY).toISOString();
  return {
    ...EMPTY_LEDGER,
    currency: "GBP",
    scholarships: [
      {
        id: "sch-1",
        name: "MTN Foundation",
        status: "deadline",
        statusLabel: "Open",
        deadline: at(3),
        color: "emerald",
      },
      {
        id: "sch-2",
        name: "Chevening",
        status: "deadline",
        statusLabel: "Open",
        deadline: at(52),
        color: "emerald",
      },
    ],
  };
}

/** Enough spend history for a pace, and not much left to spend at it. */
function tightRunwayLedger(): Ledger {
  const now = Date.now();
  return {
    ...EMPTY_LEDGER,
    currency: "GBP",
    openingBalance: 300,
    transactions: [22, 14, 7, 2].map((d, i) => ({
      id: `run-${i}`,
      type: "expense" as const,
      amount: 55,
      label: "Groceries",
      category: "food" as const,
      createdAt: new Date(now - d * DAY).toISOString(),
    })),
  };
}

/** A goal past the 90% line, for the one rule that is good news. */
function nearlyDoneGoalLedger(): Ledger {
  return {
    ...EMPTY_LEDGER,
    currency: "GBP",
    goals: [
      {
        id: "goal-1",
        name: "Replacement laptop",
        targetAmount: 900,
        savedAmount: 860,
        createdAt: new Date(Date.now() - 60 * DAY).toISOString(),
        events: [],
      },
    ],
  };
}

/**
 * Two streams, ONE of them active. The instrument's folded forecast has to
 * caption its figure with the active count (1), never the total on file (2) —
 * `totalActiveIncome` only sums active streams, so saying "2" would attach the
 * number to money that is not arriving.
 */
function hustlesLedger(): Ledger {
  return {
    ...EMPTY_LEDGER,
    currency: "GBP",
    openingBalance: 420,
    hustles: [
      {
        id: "h-1",
        name: "Tutoring, two evenings",
        amountLabel: "£180/mo",
        monthlyValue: 180,
        tag: "Teaching",
        status: "active",
      },
      {
        id: "h-2",
        name: "Brand identity retainer",
        amountLabel: "£400/mo",
        monthlyValue: 400,
        tag: "Design",
        status: "pending",
      },
    ],
  };
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
          </div>
        </Section>

        <Section
          title="2 · The attention slot"
          note="Absent unless something is genuinely urgent — that absence is the point, so the first frame here is the one that should be empty. Exactly one rule ever fires: a deadline inside 7 days, else a runway under 14, else a goal past 90%. Rule order and every boundary are verified by an executed check, not by eye."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <Labelled label="Nothing urgent (renders nothing at all)">
              <AttentionSlot attention={null} onAct={() => {}} />
            </Labelled>
            <Labelled label="Deadline inside the red band">
              <AttentionSlot
                attention={deriveAttention(deadlineLedger())}
                onAct={() => {}}
              />
            </Labelled>
            <Labelled label="Runway under two weeks">
              <AttentionSlot
                attention={deriveAttention(tightRunwayLedger())}
                onAct={() => {}}
              />
            </Labelled>
            <Labelled label="A goal within reach (accent, not the warning amber)">
              <AttentionSlot
                attention={deriveAttention(nearlyDoneGoalLedger())}
                onAct={() => {}}
              />
            </Labelled>
          </div>
        </Section>

        <Section
          title="3 · The tracking strip"
          note="What replaced the Scholarship Radar and Hustle Ledger cards. Two segments on one grid so the divider sits dead centre whichever label is longer; a populated segment opens the sheet, an empty one keeps the invitation the old card's empty state carried."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <Labelled label="Both empty (the invitation)">
              <TrackingStrip
                scholarships={[]}
                hustles={[]}
                onOpen={() => {}}
                onPrompt={() => {}}
              />
            </Labelled>
            <Labelled label="Both populated">
              <TrackingStrip
                scholarships={deadlineLedger().scholarships}
                hustles={hustlesLedger().hustles}
                onOpen={() => {}}
                onPrompt={() => {}}
              />
            </Labelled>
            <Labelled label="Mixed, and singular labels (1 / 1)">
              <TrackingStrip
                scholarships={deadlineLedger().scholarships.slice(0, 1)}
                hustles={hustlesLedger().hustles.slice(0, 1)}
                onOpen={() => {}}
                onPrompt={() => {}}
              />
            </Labelled>
            <Labelled label="Instrument with the folded forecast (1 of 2 streams active)">
              <BalanceInstrument ledger={hustlesLedger()} />
            </Labelled>
          </div>
        </Section>

        <Section
          title="4 · The trace, against its own numbers"
          note="The last point of the trace must equal the balance exactly. Proven in notes/qa/series-probe.mjs; shown here so it can be read off the screen too."
        >
          <SeriesTable days={days} onDays={setDays} />
        </Section>

        <Section
          title="5 · Palette"
          note="One hue (75) at chroma <= 0.008 carries every surface and ink. Colour appears only where it means something about money."
        >
          <Swatches />
        </Section>

        <Section
          title="6 · Radius"
          note="Three steps, by meaning. Tailwind's xl and 2xl are pinned to the container step so vendored code cannot introduce a fourth."
        >
          <Radii />
        </Section>

        <Section
          title="7 · Type"
          note="Geist for prose, Geist Mono for every figure. The mono is load-bearing here rather than decorative."
        >
          <TypeScale />
        </Section>

        <Section
          title="8 · Onboarding"
          note="Four steps, no auth. Currency and amount are collapsed into one field. The right panel is the real instrument calibrating from your answers, replacing four decorative scenes. Fully interactive: complete it and it logs the profile it would have created rather than entering the app."
        >
          <OnboardingFrame />
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

/**
 * The real Onboarding component, live.
 *
 * Completing it reports the profile it would have created instead of entering the
 * app, so the whole flow (including the memory it would seed) can be exercised
 * repeatedly without wiping localStorage between runs.
 */
function OnboardingFrame() {
  const [result, setResult] = useState<OnboardingProfile | null>(null);
  const [run, setRun] = useState(0);

  if (result) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <div className="label-caps text-[10px] text-muted-foreground">
            Profile collected
          </div>
          <dl className="font-data space-y-1.5 text-xs">
            <Row k="owner" v={result.owner} />
            <Row k="currency" v={result.currency} />
            <Row
              k="openingBalance"
              v={`${result.openingBalance} (${formatMoney(result.openingBalance, result.currency)})`}
            />
            <Row k="incomeShape" v={result.incomeShape} />
            <Row
              k="goal"
              v={
                result.goal
                  ? `${result.goal.name} @ ${formatMoney(result.goal.targetAmount, result.currency)}`
                  : "skipped"
              }
            />
          </dl>
          <div className="label-caps pt-2 text-[10px] text-muted-foreground">
            Memory it would seed
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>identity/owner — goes by {result.owner}, tracks in {result.currency}</li>
            <li>
              habit/income-shape —{" "}
              {INCOME_SHAPES.find((s) => s.value === result.incomeShape)?.memory}
            </li>
            {result.goal && <li>goal/{result.goal.name} — saving for it</li>}
          </ul>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setRun((r) => r + 1);
            }}
            className="mt-2 rounded-md bg-foreground px-3 py-1.5 text-xs text-background"
          >
            Run it again
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    // Scaled into a framed viewport so the full-screen layout can be judged
    // without leaving the review page.
    <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <div className="h-[42rem] overflow-y-auto">
        <Onboarding key={run} onComplete={setResult} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-border/50 pt-1.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate text-right">{v}</dd>
    </div>
  );
}

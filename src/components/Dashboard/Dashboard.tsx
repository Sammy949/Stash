import { useEffect } from "react";
import type { ReactNode } from "react";
import type { Goal, Ledger } from "@/types";
import { getGoals } from "@/lib/ledger";
import { deriveAttention } from "@/lib/attention";
import { BalanceInstrument } from "./BalanceInstrument";
import { AttentionSlot } from "./AttentionSlot";
import { GoalsPanel } from "./GoalsPanel";
import { TransactionList } from "./TransactionList";
import { TrackingStrip } from "./TrackingStrip";
import { FadeIn } from "@/components/UI/FadeIn";

type SectionKey = "activity" | "scholarships" | "hustles" | "goals";

/** One-shot accent-ring emphasis when this section just changed. */
function Highlight({ on, children }: { on: boolean; children: ReactNode }) {
  // rounded-xl matches Card's own radius, so the one-shot ring traces the
  // card's edge instead of sitting slightly proud of its corners. It used to
  // carry `h-full` as well, to pass a grid-stretched height down to the Card;
  // there is no grid on this dashboard any more, so that has gone with it.
  return <div className={on ? "animate-highlight rounded-xl" : undefined}>{children}</div>;
}

/**
 * Full dashboard — the default, front-facing view.
 *
 * Three permanent sections, and they are all the same KIND of thing: the
 * balance instrument (where your money is), Recent Activity (what happened to
 * it) and Goals (where it is going). Order is the hierarchy.
 *
 * What is NOT here any more is the paired Scholarship Radar / Hustle Ledger
 * row, which used to take roughly two fifths of the page. Neither belonged in
 * that company. A hustle is a standing declaration — config that changes on the
 * day you enter it and never again — and a scholarship list is spiky,
 * time-sensitive data that a fixed slot renders at one flat weight, so a
 * deadline 200 days out and one 3 days out looked identical. Between them they
 * charged attention on every visit and paid out once. They now live behind the
 * `TrackingStrip` at the foot, one row and one tap away.
 *
 * In their place, `AttentionSlot`: the single thing that has actually gone
 * urgent, or nothing at all. That is the trade — the dashboard stopped listing
 * everything Stash holds and started saying what needs you.
 *
 * The three permanent sections still render in every state, empty included: a
 * tracker that changes shape when it gains data makes the page's row heights
 * jump. The attention slot is the deliberate exception, because it is a
 * notification rather than furniture, and one that always renders "nothing to
 * report" is just a card again.
 *
 * The whole view fades in as one unit (no stagger — keeps it stable); the
 * section a turn changed gets a one-shot highlight, played when the user
 * returns here.
 */
export function Dashboard({
  ledger,
  onPrompt,
  onManage,
  onOpenGoal,
  highlight,
  onHighlightConsumed,
}: {
  ledger: Ledger;
  /** Drop a starter message into the agent (empty-tile "add" flow). */
  onPrompt: (text: string) => void;
  /** Open the Manage sheet for a tracker domain. */
  onManage: (domain: "scholarships" | "hustles" | "goals") => void;
  /** Open one goal's history. */
  onOpenGoal: (goal: Goal) => void;
  /** Section to emphasise on this mount, or null. */
  highlight: SectionKey | null;
  /** Called once the highlight has been shown, so it doesn't replay. */
  onHighlightConsumed: () => void;
}) {
  // Use the getGoals accessor — pre-v4 cached ledgers have no `goals` field,
  // and reading `.length` off undefined crashes the whole dashboard render.
  const goals = getGoals(ledger);

  // Recomputed every render, on purpose: it is pure, cheap, and reading it from
  // the ledger each time is what makes the slot appear the instant a turn logs
  // the transaction that pushes the runway under the line.
  const attention = deriveAttention(ledger);

  // Consume the highlight once it has had time to play.
  //
  // This used to be mount-only, which worked because the dashboard unmounted
  // every time the user went to the transcript and came back. At lg it never
  // unmounts — both panes are always on screen — so a highlight set by a turn
  // would have been set once and never cleared, leaving the ring stuck on. It
  // is keyed on the prop now, which is the thing that actually changed.
  useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(onHighlightConsumed, 2400);
    return () => window.clearTimeout(t);
  }, [highlight, onHighlightConsumed]);

  return (
    // Width is owned once, by the pane, not again here. Five scattered
    // max-w-2xl were what made every breakpoint a 672px phone screenshot.
    <FadeIn className="w-full">
      <div className="space-y-5">
        <BalanceInstrument ledger={ledger} />

        {/* Directly under the instrument, because it is about the numbers just
            above it — and above Recent Activity, because something that needs a
            decision outranks a record of what already happened. */}
        <AttentionSlot attention={attention} onAct={onPrompt} />

        <Highlight on={highlight === "activity"}>
          <TransactionList
            transactions={ledger.transactions}
            currency={ledger.currency}
          />
        </Highlight>

        <Highlight on={highlight === "goals"}>
          <GoalsPanel
            goals={goals}
            currency={ledger.currency}
            onManage={() => onManage("goals")}
            onAdd={() => onPrompt("I want to set a savings goal.")}
            onOpen={onOpenGoal}
          />
        </Highlight>

        {/* Both tracker highlights resolve here now, which is correct rather
            than a compromise: the strip IS where a new scholarship or income
            stream lands, so it is the thing that should flash when a turn adds
            one. */}
        <Highlight
          on={highlight === "scholarships" || highlight === "hustles"}
        >
          <TrackingStrip
            scholarships={ledger.scholarships}
            hustles={ledger.hustles}
            onOpen={onManage}
            onPrompt={onPrompt}
          />
        </Highlight>
      </div>
    </FadeIn>
  );
}

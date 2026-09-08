import { useEffect } from "react";
import type { ReactNode } from "react";
import type { Ledger, SyncPhase } from "@/types";
import { getGoals } from "@/lib/ledger";
import { BalanceInstrument } from "./BalanceInstrument";
import { ScholarshipRadar } from "./ScholarshipRadar";
import { HustleLedger } from "./HustleLedger";
import { GoalsPanel } from "./GoalsPanel";
import { TransactionList } from "./TransactionList";
import { FadeIn } from "@/components/UI/FadeIn";

type SectionKey = "activity" | "scholarships" | "hustles" | "goals";

/** One-shot accent-ring emphasis when this section just changed. */
function Highlight({ on, children }: { on: boolean; children: ReactNode }) {
  // h-full so a grid-stretched wrapper passes its height down to the Card.
  // rounded-xl matches Card's own radius, so the one-shot ring traces the
  // card's edge instead of sitting slightly proud of its corners.
  return (
    <div className={on ? "animate-highlight h-full rounded-xl" : "h-full"}>
      {children}
    </div>
  );
}

/**
 * Full dashboard — the default, front-facing view.
 *
 * Order: the balance instrument → Recent Activity (the pulse) → the two
 * trackers as a paired row (stacked on mobile, side-by-side on ≥sm) → Goals.
 * The whole view fades in as one unit (no stagger — keeps it stable); the
 * section a turn changed gets a one-shot highlight, played when the user
 * returns here.
 *
 * Every section renders in every state, empty included. There used to be a
 * second surface for empty trackers (a dashed `+` tile that replaced the
 * section outright), which meant a tracker changed shape the moment it held
 * data and the dashboard's row heights jumped with it. The instrument already
 * settled the principle: empty is the same object, calibrated and waiting.
 */
export function Dashboard({
  ledger,
  syncPhase,
  hydrating,
  onPrompt,
  onManage,
  highlight,
  onHighlightConsumed,
}: {
  ledger: Ledger;
  syncPhase: SyncPhase;
  hydrating: boolean;
  /** Drop a starter message into the agent (empty-tile "add" flow). */
  onPrompt: (text: string) => void;
  /** Open the Manage sheet for a tracker domain. */
  onManage: (domain: "scholarships" | "hustles" | "goals") => void;
  /** Section to emphasise on this mount, or null. */
  highlight: SectionKey | null;
  /** Called once the highlight has been shown, so it doesn't replay. */
  onHighlightConsumed: () => void;
}) {
  // Use the getGoals accessor — pre-v4 cached ledgers have no `goals` field,
  // and reading `.length` off undefined crashes the whole dashboard render.
  const goals = getGoals(ledger);

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
        <BalanceInstrument
          ledger={ledger}
          syncPhase={syncPhase}
          hydrating={hydrating}
        />

        <Highlight on={highlight === "activity"}>
          <TransactionList
            transactions={ledger.transactions}
            currency={ledger.currency}
            hydrating={hydrating}
          />
        </Highlight>

        {/* @2xl, not sm: this keys off the DASHBOARD's width, not the window's.
            In the lg two-pane layout the dashboard is a ~40% column, so a
            viewport breakpoint would have paired these up at ~270px each on a
            1440 screen. They pair when the column is genuinely wide enough
            (42rem) and stack when it is not.

            Deliberately NOT items-start: the two trackers are a parallel pair,
            so they share a height and their controls share a baseline. Letting
            each size to its own content is what makes a comparison row read as
            ragged. */}
        <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
          <Highlight on={highlight === "scholarships"}>
            <ScholarshipRadar
              scholarships={ledger.scholarships}
              onManage={() => onManage("scholarships")}
              onAdd={() =>
                onPrompt("I want to track a new scholarship deadline.")
              }
            />
          </Highlight>

          <Highlight on={highlight === "hustles"}>
            <HustleLedger
              hustles={ledger.hustles}
              currency={ledger.currency}
              onManage={() => onManage("hustles")}
              onAdd={() => onPrompt("I want to add a side income stream.")}
            />
          </Highlight>
        </div>

        <Highlight on={highlight === "goals"}>
          <GoalsPanel
            goals={goals}
            currency={ledger.currency}
            onManage={() => onManage("goals")}
            onAdd={() => onPrompt("I want to set a savings goal.")}
          />
        </Highlight>
      </div>
    </FadeIn>
  );
}

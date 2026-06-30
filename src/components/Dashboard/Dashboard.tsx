import { useEffect } from "react";
import type { ReactNode } from "react";
import type { Ledger, SyncPhase } from "@/types";
import { VaultCard } from "./VaultCard";
import { ScholarshipRadar } from "./ScholarshipRadar";
import { HustleLedger } from "./HustleLedger";
import { TransactionList } from "./TransactionList";
import { TrackerTile } from "./TrackerTile";
import { FadeIn } from "@/components/UI/FadeIn";
import { BoltIcon, RadarIcon } from "@/components/UI/icons";

type SectionKey = "activity" | "scholarships" | "hustles";

/** One-shot accent-ring emphasis when this section just changed. */
function Highlight({ on, children }: { on: boolean; children: ReactNode }) {
  return <div className={on ? "animate-highlight rounded-2xl" : ""}>{children}</div>;
}

/**
 * Full dashboard — the default, front-facing view.
 *
 * Order: Vault → Recent Activity (the pulse) → the two trackers as a paired
 * row (stacked on mobile, side-by-side on ≥sm). Empty trackers show a `+`
 * tile; populated ones show their list. The whole view fades in as one unit
 * (no stagger — keeps it stable); the section a turn changed gets a one-shot
 * highlight, played when the user returns here.
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
  onManage: (domain: "scholarships" | "hustles") => void;
  /** Section to emphasise on this mount, or null. */
  highlight: SectionKey | null;
  /** Called once the highlight has been shown, so it doesn't replay. */
  onHighlightConsumed: () => void;
}) {
  const noScholarships = ledger.scholarships.length === 0;
  const noHustles = ledger.hustles.length === 0;

  // Consume the highlight after it has had time to play (the dashboard remounts
  // when the user returns to it, so this runs each time there's one pending).
  useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(onHighlightConsumed, 2400);
    return () => window.clearTimeout(t);
    // Mount-only: the dashboard remounts on return, so a pending highlight
    // plays then; we deliberately don't re-run on prop changes.
  }, []);

  return (
    <FadeIn className="mx-auto w-full max-w-2xl">
      <div className="space-y-5">
        <VaultCard ledger={ledger} syncPhase={syncPhase} hydrating={hydrating} />

        <Highlight on={highlight === "activity"}>
          <TransactionList
            transactions={ledger.transactions}
            currency={ledger.currency}
          />
        </Highlight>

        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <Highlight on={highlight === "scholarships"}>
            {noScholarships ? (
              <TrackerTile
                icon={<RadarIcon className="h-5 w-5" />}
                title="Scholarship Radar"
                subtitle="No active deadlines"
                onAdd={() =>
                  onPrompt("I want to track a new scholarship deadline.")
                }
              />
            ) : (
              <ScholarshipRadar
                scholarships={ledger.scholarships}
                onManage={() => onManage("scholarships")}
              />
            )}
          </Highlight>

          <Highlight on={highlight === "hustles"}>
            {noHustles ? (
              <TrackerTile
                icon={<BoltIcon className="h-5 w-5" />}
                title="Hustle Ledger"
                subtitle="No active income"
                onAdd={() => onPrompt("I want to add a side income stream.")}
              />
            ) : (
              <HustleLedger
                hustles={ledger.hustles}
                currency={ledger.currency}
                onManage={() => onManage("hustles")}
              />
            )}
          </Highlight>
        </div>
      </div>
    </FadeIn>
  );
}

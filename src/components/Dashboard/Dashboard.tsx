import type { Ledger, SyncPhase } from "@/types";
import { VaultCard } from "./VaultCard";
import { ScholarshipRadar } from "./ScholarshipRadar";
import { HustleLedger } from "./HustleLedger";
import { TransactionList } from "./TransactionList";
import { TrackerTile } from "./TrackerTile";
import { FadeIn } from "@/components/UI/FadeIn";
import { BoltIcon, RadarIcon } from "@/components/UI/icons";

/**
 * Full dashboard — the default, front-facing view.
 *
 * Order: Vault → Recent Activity (the pulse) → the two trackers as a paired
 * 2-col row. Empty trackers show a `+` tile; populated ones show their list.
 * Sections fade in on mount (staggered).
 */
export function Dashboard({
  ledger,
  syncPhase,
  hydrating,
  onPrompt,
}: {
  ledger: Ledger;
  syncPhase: SyncPhase;
  hydrating: boolean;
  /** Drop a starter message into the agent (empty-tile "add" flow). */
  onPrompt: (text: string) => void;
}) {
  const noScholarships = ledger.scholarships.length === 0;
  const noHustles = ledger.hustles.length === 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <FadeIn delay={0}>
        <VaultCard ledger={ledger} syncPhase={syncPhase} hydrating={hydrating} />
      </FadeIn>

      <FadeIn delay={70}>
        <TransactionList
          transactions={ledger.transactions}
          currency={ledger.currency}
        />
      </FadeIn>

      <div className="grid grid-cols-2 items-start gap-4">
        <FadeIn delay={140} className="h-full">
          {noScholarships ? (
            <TrackerTile
              icon={<RadarIcon className="h-4 w-4" />}
              title="Scholarship Radar"
              subtitle="No active deadlines"
              onAdd={() => onPrompt("I want to track a new scholarship deadline.")}
            />
          ) : (
            <ScholarshipRadar scholarships={ledger.scholarships} />
          )}
        </FadeIn>

        <FadeIn delay={210} className="h-full">
          {noHustles ? (
            <TrackerTile
              icon={<BoltIcon className="h-4 w-4" />}
              title="Hustle Ledger"
              subtitle="No active income"
              onAdd={() => onPrompt("I want to add a side income stream.")}
            />
          ) : (
            <HustleLedger hustles={ledger.hustles} currency={ledger.currency} />
          )}
        </FadeIn>
      </div>
    </div>
  );
}

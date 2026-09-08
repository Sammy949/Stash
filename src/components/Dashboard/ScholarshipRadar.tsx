import type { Scholarship } from "@/types";
import { daysUntil, deriveUrgency, radarBadge } from "@/lib/ledger";
import { RadarIcon } from "@/components/UI/icons";
import { EmptyState } from "@/components/UI/EmptyState";
import { ScholarshipCard } from "@/components/UI/ScholarshipCard";
import { ItemGroup } from "@/components/shadcn/item";
import { Section, SectionAction } from "./Section";

const VISIBLE = 2;

/** Urgency band → ink. Same mapping the row countdown uses. */
const TONE: Record<string, string> = {
  emerald: "text-success",
  amber: "text-warning",
  red: "text-destructive",
  muted: "text-muted-foreground",
};

/**
 * The soonest deadline still ahead. This is real information and not a repeat
 * of the first row: rows are in the order they were added, so once there are
 * more scholarships than fit, the most urgent one can easily be out of sight.
 */
function nextDue(scholarships: Scholarship[]): Scholarship | null {
  return (
    scholarships
      .filter((s) => s.deadline && daysUntil(s.deadline) >= 0)
      .sort((a, b) => daysUntil(a.deadline!) - daysUntil(b.deadline!))[0] ?? null
  );
}

export function ScholarshipRadar({
  scholarships,
  onManage,
  onAdd,
}: {
  scholarships: Scholarship[];
  /** Open the Manage sheet (shown as "View all" once past VISIBLE). */
  onManage?: () => void;
  /** Prime the agent to track the first deadline, from the empty state. */
  onAdd?: () => void;
}) {
  const overflow = onManage && scholarships.length > VISIBLE;
  const shown = overflow ? scholarships.slice(0, VISIBLE) : scholarships;
  const soonest = nextDue(scholarships);

  return (
    <Section
      icon={<RadarIcon className="size-3.5" />}
      title="Scholarship Radar"
      action={
        overflow ? (
          <SectionAction
            kind="open"
            onClick={onManage!}
            label={`View all ${scholarships.length}`}
          />
        ) : undefined
      }
      // The radar carries a summary floor for the same reason the hustle ledger
      // does: the two sit side by side as a pair, and a card that ends on a
      // derived figure next to one that just stops leaves their controls on
      // different lines and the row reads as ragged.
      summary={
        scholarships.length === 0 ? undefined : (
          <>
            <span className="label-caps text-[10px] text-muted-foreground">
              Next deadline
            </span>
            <span
              className={`font-data text-sm font-semibold ${
                soonest ? TONE[deriveUrgency(soonest)] : "text-muted-foreground"
              }`}
            >
              {soonest ? radarBadge(soonest) : "None upcoming"}
            </span>
          </>
        )
      }
    >
      {scholarships.length === 0 ? (
        <EmptyState
          title="No deadlines tracked yet"
          hint={
            <>
              Tell Stash{" "}
              <span className="text-foreground">
                &ldquo;I&rsquo;m applying for the MTN scholarship, deadline Aug
                30&rdquo;
              </span>
              .
            </>
          }
          action={
            onAdd ? { label: "Track a deadline", onClick: onAdd } : undefined
          }
        />
      ) : (
        <ItemGroup>
          {shown.map((s) => (
            <ScholarshipCard
              key={s.id}
              scholarship={s}
              className="w-full px-0"
              role="listitem"
              variant="default"
            />
          ))}
        </ItemGroup>
      )}
    </Section>
  );
}

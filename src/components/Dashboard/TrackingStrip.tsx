import type { ReactNode } from "react";
import type { Hustle, Scholarship } from "@/types";
import { BoltIcon, RadarIcon } from "@/components/UI/icons";

/**
 * What Stash is also keeping for you, in one row.
 *
 * This replaces the Scholarship Radar and Hustle Ledger cards, which between
 * them held roughly two fifths of the dashboard's height. The reason they went
 * is that neither is the same KIND of thing as the balance, the activity log or
 * the goals: a scholarship list is spiky, time-sensitive data that a fixed slot
 * cannot rank (that job moved to the attention slot), and an income stream is a
 * standing declaration — config, effectively, which changes on the day you enter
 * it and never again. Both cost attention on every single visit and paid out
 * once. As a strip they cost one row and stay one tap away.
 *
 * They stay ON the dashboard rather than moving into the account menu because
 * they are the two things that say who this was built for. Someone scanning the
 * page for ten seconds should still see that Stash tracks scholarship deadlines
 * and irregular side income.
 *
 * Both segments are always present and always the same shape, so the row never
 * reflows as data arrives: a populated segment states a count and opens the
 * sheet, an empty one states the invitation the old card's empty state carried
 * and primes the agent. Nothing was lost in the move.
 *
 * The monthly income figure deliberately did NOT come here with the hustles. It
 * sits in the balance instrument, where a forecast frames the balance it
 * belongs to; stating it in both places would be the same number twice on one
 * screen. The strip counts what is tracked, and nothing else.
 */
export function TrackingStrip({
  scholarships,
  hustles,
  onOpen,
  onPrompt,
}: {
  scholarships: Scholarship[];
  hustles: Hustle[];
  /** Open a domain's Manage sheet. */
  onOpen: (domain: "scholarships" | "hustles") => void;
  /** Prime the agent to add the first one. */
  onPrompt: (text: string) => void;
}) {
  return (
    // The card surface, at a single row's height — the strip belongs to the
    // page's material without pretending to be another section.
    //
    // `overflow-hidden` is load-bearing, and it is what `Card` itself carries
    // for the same reason: the segments fill edge to edge, so without it a
    // hover fill would square off the strip's rounded corners. The segments in
    // turn draw NO radius of their own — giving them one made the left half's
    // right corners curve away from the divider on hover, leaving a rounded tab
    // floating in the middle of the row. The container owns the shape; the
    // segments are clipped to it.
    <section className="flex items-stretch overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Segment
        icon={<RadarIcon className="size-3.5" />}
        label={
          scholarships.length > 0
            ? `${scholarships.length} ${scholarships.length === 1 ? "scholarship" : "scholarships"}`
            : "Track a deadline"
        }
        muted={scholarships.length === 0}
        onClick={() =>
          scholarships.length > 0
            ? onOpen("scholarships")
            : onPrompt("I want to track a new scholarship deadline.")
        }
      />

      {/* The same hairline divider the balance instrument sets between In and
          Out. Reused rather than reinvented, so the two rows are measured off
          one object. `my-3` insets it from the row's ends instead of running
          the full height, which is what keeps it a separator and not a border. */}
      <div className="my-3 w-px shrink-0 bg-border" aria-hidden />

      <Segment
        icon={<BoltIcon className="size-3.5" />}
        label={
          hustles.length > 0
            ? `${hustles.length} ${hustles.length === 1 ? "income stream" : "income streams"}`
            : "Add an income stream"
        }
        muted={hustles.length === 0}
        onClick={() =>
          hustles.length > 0
            ? onOpen("hustles")
            : onPrompt("I want to add a side income stream.")
        }
      />
    </section>
  );
}

/**
 * One half of the row.
 *
 * `flex-1 basis-0` on both is what holds the pair on one grid: the two segments
 * split the width evenly regardless of which label is longer, so the divider
 * sits dead centre and neither side's copy decides where the other's content
 * lands.
 */
function Segment({
  icon,
  label,
  muted,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  muted: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // min-w-0 lets the label truncate rather than push its sibling out of the
      // card's clipped edge. Hover is a tonal step and nothing else: no lift, no
      // shadow, no glowing border — the same restraint the goal rows use, and
      // no radius, because the container clips the shape (see above).
      className="flex min-w-0 flex-1 basis-0 items-center gap-2 px-4 py-3.5 text-left outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.04]"
    >
      <span
        className={`shrink-0 ${muted ? "text-muted-foreground" : "text-foreground"}`}
        aria-hidden
      >
        {icon}
      </span>

      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

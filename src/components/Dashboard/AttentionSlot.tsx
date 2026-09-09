import type { Attention, AttentionKind } from "@/lib/attention";
import {
  ArrowUpRightIcon,
  RadarIcon,
  RunwayIcon,
  TargetIcon,
} from "@/components/UI/icons";
import { Button } from "@/components/shadcn/button";

/**
 * The one thing that needs you, or nothing at all.
 *
 * Deliberately NOT a `Section`. Every section on this dashboard opens with the
 * same mono-caps heading, and giving this one that costume would make it read as
 * a fifth permanent card — which is the exact problem the slot exists to solve.
 * It shares the card's surface (same radius, same ring, same fill) so it belongs
 * to the page, but it is one row of prose with a control, and it has no title.
 *
 * It is also absent by default, which is the other half of the point. The
 * trackers around it hold their shape when empty because they are furniture; a
 * notification is not furniture, and one that renders "nothing to report" is
 * just a card teaching the eye to skip it.
 *
 * Nothing here is hidden behind an animation: the row is in the DOM with its
 * final opacity, and `animate-slide-up` only supplies a starting offset. If the
 * animation never runs the line is fully readable.
 */

/** The mark says what the line is ABOUT, reusing the dashboard's own vocabulary
 *  — the radar for deadlines and the target for goals are the same marks their
 *  trackers carry, so the slot reads as one of them speaking up rather than a
 *  generic alert. Only the runway needed a mark of its own. */
const MARK: Record<AttentionKind, typeof RadarIcon> = {
  deadline: RadarIcon,
  runway: RunwayIcon,
  goal: TargetIcon,
};

/**
 * Ink, and it is the only colour on the row.
 *
 * Amber is warnings-only in this palette, so it covers the two rules that mean
 * something could go wrong and nothing else. A goal within reach is good news,
 * so it takes the accent rather than borrowing the alarm.
 */
const TONE: Record<AttentionKind, string> = {
  deadline: "text-warning",
  runway: "text-warning",
  goal: "text-primary",
};

export function AttentionSlot({
  attention,
  onAct,
}: {
  attention: Attention | null;
  /** Hand the line to the agent (primes its `prompt` into the composer). */
  onAct: (prompt: string) => void;
}) {
  if (!attention) return null;

  const Mark = MARK[attention.kind];

  return (
    <section
      // A live region: when a turn makes something urgent this row appears with
      // no other announcement, so a screen reader has to be told it arrived.
      role="status"
      className="animate-slide-up flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
    >
      <Mark className={`size-4 shrink-0 ${TONE[attention.kind]}`} aria-hidden />

      {/* min-w-0 so a long scholarship name wraps inside the row instead of
          shouldering the button off the card's clipped edge. */}
      <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">
        {attention.text}
      </p>

      {/* The same up-and-out diagonal `SectionAction` uses for "this leaves for
          somewhere else", because that is what it does: the slot never answers,
          it hands the question to the conversation. */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onAct(attention.prompt)}
        className="h-9 shrink-0 gap-1.5 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
      >
        {attention.actionLabel}
        <ArrowUpRightIcon />
      </Button>
    </section>
  );
}
